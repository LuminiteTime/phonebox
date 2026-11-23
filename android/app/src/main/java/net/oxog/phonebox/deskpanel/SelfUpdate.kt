package net.oxog.phonebox.deskpanel

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Fork (docs/fork/DESIGN.md, "Updates"): the app updates itself from the agent, over USB or Wi-Fi, without adb.
 * The agent hands over the newer APK of the fork's latest release (GET /api/fork/app); the app installs it with
 * PackageInstaller. Android 12+ installs it silently once this app is its own installer of record (after the first
 * self-update); before that, and on older systems, Android asks once with its own dialog.
 * It checks every 15 minutes, and at once when the settings page asked for it (POST /api/fork/app/now); each step is
 * reported back (POST /api/fork/app/status), so the settings page tells why an update did not land.
 */
class SelfUpdate(private val context: Context, private val link: AgentLink) {
    private val timer = Executors.newSingleThreadScheduledExecutor()

    private var nextCheck = 0L

    fun start() { timer.scheduleWithFixedDelay(::tick, 20, TICK_SEC, TimeUnit.SECONDS) }

    fun stop() = timer.shutdownNow()

    private fun tick() {
        try {
            outcome?.let { outcome = null; report(it) }
            val asked = pushed()
            if (System.currentTimeMillis() < nextCheck && !asked) return
            nextCheck = System.currentTimeMillis() + CHECK_EVERY_MIN * 60_000
            check(asked)
        } catch (e: Exception) {
            Log.w(TAG, "self-update failed", e) // the next round tries again
            runCatching { report("ошибка: ${e.message}") }
        }
    }

    /** Whether the settings page asked for an update now (the agent forgets the ask once it told us). */
    private fun pushed(): Boolean {
        val reply = link.request("POST", "/api/fork/app/take")
        val body = reply.body.use { it.readBytes().decodeToString() }
        return reply.code == 200 && org.json.JSONObject(body).optBoolean("push")
    }

    private fun check(asked: Boolean) {
        val have = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: return
        if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
            report("$have: нет разрешения «Установка приложений» для PhoneBox" + if (asked) ", открыл его на планшете" else "")
            if (asked) context.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, android.net.Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        val reply = link.request("GET", "/api/fork/app?have=$have")
        if (reply.code != 200 || reply.contentType?.startsWith(APK_TYPE) != true) { reply.body.close(); return }
        reply.body.use { install(it) }
        report("$have: передал установщику Android")
    }

    private fun report(text: String) =
        link.request("POST", "/api/fork/app/status?text=${java.net.URLEncoder.encode(text, "UTF-8")}").body.close()

    private fun install(apk: java.io.InputStream) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id = installer.createSession(params)
        installer.openSession(id).use { session ->
            session.openWrite("app.apk", 0, -1).use { out -> apk.copyTo(out); session.fsync(out) }
            val done = Intent(context, Result::class.java)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            session.commit(PendingIntent.getBroadcast(context, id, done, flags).intentSender)
        }
        Log.i(TAG, "self-update handed to the installer")
    }

    /** The installer's answer: shows Android's confirmation when it needs one. */
    class Result : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                outcome = "ждёт «Обновить» на экране планшета"
            } else if (status != PackageInstaller.STATUS_SUCCESS) {
                val why = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                Log.w(TAG, "self-update refused: $why")
                outcome = "Android отказал ($status): $why"
            }
        }
    }

    /** After the update Android stops the app: open the panel again. */
    class Replaced : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
            context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    companion object {
        private const val TAG = "PhoneBox"
        private const val APK_TYPE = "application/vnd.android.package-archive"
        private const val CHECK_EVERY_MIN = 15L
        private const val TICK_SEC = 30L

        /** What the installer answered, reported on the next tick (the receiver has no link to the agent). */
        @Volatile var outcome: String? = null
    }
}
