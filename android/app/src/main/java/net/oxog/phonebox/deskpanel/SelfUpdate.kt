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
 */
class SelfUpdate(private val context: Context, private val link: AgentLink) {
    private val timer = Executors.newSingleThreadScheduledExecutor()

    fun start() { timer.scheduleWithFixedDelay(::check, 20, CHECK_EVERY_MIN * 60, TimeUnit.SECONDS) }

    fun stop() = timer.shutdownNow()

    private fun check() {
        try {
            val have = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: return
            val reply = link.request("GET", "/api/fork/app?have=$have")
            if (reply.code != 200 || reply.contentType?.startsWith(APK_TYPE) != true) { reply.body.close(); return }
            reply.body.use { install(it) }
        } catch (e: Exception) {
            Log.w(TAG, "self-update failed", e) // the next round tries again
        }
    }

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
            } else if (status != PackageInstaller.STATUS_SUCCESS) {
                Log.w(TAG, "self-update refused: ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
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

    private companion object {
        const val TAG = "PhoneBox"
        const val APK_TYPE = "application/vnd.android.package-archive"
        const val CHECK_EVERY_MIN = 15L
    }
}
