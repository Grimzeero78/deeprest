package expo.modules.deeprestusage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.app.AppOpsManager.OPSTR_GET_USAGE_STATS
import android.app.AppOpsManager.MODE_ALLOWED
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.definition.ModuleDefinition
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * DeepRest native module — reads REAL per-app foreground screen time from
 * Android's UsageStatsManager. Requires the special "Usage access"
 * permission (granted manually in Settings, no runtime dialog exists).
 */
class DeeprestUsageModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("DeeprestUsage")

    /** true when the user has granted Usage access in system settings. */
    Function("hasPermission") {
      isUsageAccessGranted()
    }

    /** Opens the system "Usage access" settings screen. */
    Function("openPermissionSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /**
     * Aggregated foreground minutes per app since local midnight.
     * Returns [{ packageName, label, minutes }] sorted by minutes desc.
     * Filters out launchers/system UI and this app itself.
     */
    Function("getTodayUsage") {
      getTodayUsage()
    }
  }

  private fun isUsageAccessGranted(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == MODE_ALLOWED
  }

  private fun getTodayUsage(): List<Map<String, Any>> {
    if (!isUsageAccessGranted()) {
      throw Exception("Usage access permission has not been granted yet")
    }

    val usageStatsManager =
      context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    val midnight = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    val stats = usageStatsManager.queryAndAggregateUsageStats(
      midnight.timeInMillis,
      System.currentTimeMillis()
    )
    val pm = context.packageManager
    val self = context.packageName
    val excluded = setOf(
      self,
      "com.android.systemui",
      "com.android.launcher3",
      "com.google.android.apps.nexuslauncher",
      "com.sec.android.app.launcher",
      "com.miui.home",
      "com.android.launcher"
    )

    val entries = mutableListOf<Map<String, Any>>()
    for (stat in stats.values) {
      val foregroundMs = stat.totalTimeInForeground
      // Ignore sub-minute blips (notifications pulling an app to front, etc.)
      if (foregroundMs < 60_000L) continue
      if (stat.packageName in excluded) continue

      val label = try {
        pm.getApplicationLabel(pm.getApplicationInfo(stat.packageName, 0)).toString()
      } catch (e: PackageManager.NameNotFoundException) {
        stat.packageName
      }

      entries.add(
        mapOf(
          "packageName" to stat.packageName,
          "label" to label,
          "minutes" to TimeUnit.MILLISECONDS.toMinutes(foregroundMs).toInt()
        )
      )
    }

    entries.sortByDescending { it["minutes"] as Int }
    return entries
  }
}
