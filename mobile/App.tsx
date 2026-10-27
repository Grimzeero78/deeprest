import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  clearToken,
  getMe,
  loadToken,
  login,
  syncScreenTime,
  type MeResponse,
} from "./src/api";
import {
  buildSyncPayload,
  getTodayUsage,
  hasUsagePermission,
  isNativeAvailable,
  openUsagePermissionSettings,
} from "./src/usage";

// ------------------------------------------------------------------
// Background sync task — runs hourly even when the app is closed.
// Android's background-fetch windows are opportunistic; the main
// "Sync now" path plus sync-on-open keeps data fresh regardless.
// ------------------------------------------------------------------
const BACKGROUND_SYNC_TASK = "deeprest-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const token = await loadToken();
    if (!token || !hasUsagePermission()) return BackgroundFetch.Result.NoData;
    const payload = buildSyncPayload(getTodayUsage());
    if (payload.totalMinutes <= 0) return BackgroundFetch.Result.NoData;
    await syncScreenTime(token, payload.totalMinutes, payload.topApps);
    return BackgroundFetch.Result.NewData;
  } catch {
    return BackgroundFetch.Result.Failed;
  }
});

// ---------- theme (matches the DeepRest web palette) ----------
const C = {
  bg: "#0f0d1e",
  card: "#1b1733",
  cardAlt: "#241f45",
  border: "#332c5e",
  text: "#f1efff",
  dim: "#a49cc9",
  accent: "#8b5cf6",
  accentSoft: "#6d28d9",
  green: "#34d399",
  red: "#f87171",
  amber: "#fbbf24",
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await loadToken();
      if (stored) {
        try {
          setMe(await getMe(stored));
          setToken(stored);
        } catch {
          await clearToken();
        }
      }
      setBooting(false);
    })();
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setMe(null);
  }, []);

  if (booting) return <Splash />;
  if (!token || !me) return <LoginScreen onSignedIn={(tok, data) => { setToken(tok); setMe(data); }} />;
  return (
    <HomeScreen
      me={me}
      token={token}
      onData={setMe}
      onSignOut={signOut}
    />
  );
}

// ==================================================================
// Splash
// ==================================================================
function Splash() {
  return (
    <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
      <ExpoStatusBar style="light" />
      <Text style={{ fontSize: 40 }}>🌙</Text>
      <Text style={[styles.brand, { marginTop: 8 }]}>DeepRest</Text>
      <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
    </View>
  );
}

// ==================================================================
// Login / Register
// ==================================================================
function LoginScreen({ onSignedIn }: { onSignedIn: (token: string, me: MeResponse) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setHintShown(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const { token } = await register(name.trim(), password, confirm, hint.trim());
        onSignedIn(token, await getMe(token));
      } else {
        const { token } = await login(name.trim(), password);
        onSignedIn(token, await getMe(token));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      // The API returns a helpful hint after a failed sign-in.
      if (msg.toLowerCase().includes("incorrect")) {
        setHintShown("Open the website once to see your password hint, or register here.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "android" ? undefined : "padding"}
    >
      <ExpoStatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 44, textAlign: "center", marginTop: 48 }}>🌙</Text>
        <Text style={[styles.brand, { textAlign: "center", marginTop: 6 }]}>DeepRest</Text>
        <Text style={[styles.dim, { textAlign: "center", marginTop: 4 }]}>
          {mode === "login" ? "Welcome back — no email needed." : "Create your account — no email needed."}
        </Text>

        <View style={[styles.card, { marginTop: 24 }]}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
          {mode === "register" && (
            <>
              <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secure />
              <Field label="Password hint (optional)" value={hint} onChangeText={setHint} placeholder="e.g. my usual + year" />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {hintShown ? <Text style={styles.hint}>{hintShown}</Text> : null}

          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryText}>{mode === "login" ? "Sign in" : "Create account"}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setHintShown(null); }} style={{ marginTop: 14 }}>
            <Text style={{ color: C.accent, textAlign: "center", fontWeight: "600" }}>
              {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.dim, { textAlign: "center", marginTop: 20, fontSize: 12 }]}>
          Same account as the website — your streak, rank and AI companions carry over.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secure?: boolean;
  autoCapitalize?: "none" | "words";
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={C.dim}
        secureTextEntry={props.secure}
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoCorrect={false}
      />
    </View>
  );
}

// ==================================================================
// Home — real screen time from this phone
// ==================================================================
function HomeScreen({
  me,
  token,
  onData,
  onSignOut,
}: {
  me: MeResponse;
  token: string;
  onData: (m: MeResponse) => void;
  onSignOut: () => void;
}) {
  const [permitted, setPermitted] = useState<boolean>(hasUsagePermission());
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const appState = useRef(AppState.currentState);

  const refreshMe = useCallback(async () => {
    try {
      onData(await getMe(token));
    } catch {
      /* keep showing cached data */
    }
  }, [token, onData]);

  // Re-check permission when the user returns from system Settings.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && appState.current !== "active") {
        setPermitted(hasUsagePermission());
        refreshMe();
      }
      appState.current = s;
    });
    return () => sub.remove();
  }, [refreshMe]);

  // Register hourly background sync (best effort).
  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(() => {});
    return () => {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK).catch(() => {});
    };
  }, []);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setMessage(null);
    try {
      if (!hasUsagePermission()) {
        openUsagePermissionSettings();
        return;
      }
      const payload = buildSyncPayload(getTodayUsage());
      await syncScreenTime(token, payload.totalMinutes, payload.topApps);
      setPermitted(true);
      setLastSync(new Date());
      setMessage(
        payload.totalMinutes > 0
          ? `Synced ${formatHm(payload.totalMinutes)} of real usage + ${payload.topApps.length} top apps`
          : "No usage recorded yet today"
      );
      await refreshMe();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMe();
    setRefreshing(false);
  };

  const { today, rank, user } = me;
  const pct = today.targetMin > 0 ? Math.min(100, Math.round((today.minutesUsed / today.targetMin) * 100)) : 0;
  const barColor = today.metTarget ? C.green : C.red;

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <View>
            <Text style={styles.brand}>DeepRest</Text>
            <Text style={styles.dim}>Hi {user.name} 👋</Text>
          </View>
          <Pressable onPress={onSignOut} hitSlop={8}>
            <Text style={{ color: C.dim, fontSize: 13 }}>Sign out</Text>
          </Pressable>
        </View>

        {/* rank card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.dim}>Rank</Text>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>{rank.current.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: C.amber, fontWeight: "800", fontSize: 18 }}>{user.totalPoints} XP</Text>
              <Text style={styles.dim}>🔥 {user.streak}-day streak</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${rank.progressPercent}%`, backgroundColor: C.accent }]} />
          </View>
          <Text style={styles.dim}>
            {rank.next ? `${rank.progressPercent}% to ${rank.next.name}` : "Highest rank reached!"}
          </Text>
        </View>

        {/* usage access card */}
        {!permitted ? (
          <View style={[styles.card, { borderColor: C.amber, borderWidth: 1 }]}>
            <Text style={{ color: C.amber, fontWeight: "800", marginBottom: 6 }}>⚙️ One-time permission needed</Text>
            <Text style={{ color: C.dim, fontSize: 13, lineHeight: 19 }}>
              {isNativeAvailable
                ? "Android requires you to manually allow DeepRest to read usage stats. Tap below, find DeepRest in the list, and toggle it on — then come back."
                : "This build lacks the native usage module. Rebuild the dev client (npx expo run:android) to enable automatic tracking."}
            </Text>
            {isNativeAvailable && (
              <Pressable style={[styles.primaryBtn, { backgroundColor: C.amber, marginTop: 12 }]} onPress={openUsagePermissionSettings}>
                <Text style={[styles.primaryText, { color: "#1f2937" }]}>Enable Usage Access</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* today card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 17 }}>Today</Text>
            <Text style={{ color: today.metTarget ? C.green : C.red, fontWeight: "700" }}>
              {today.metTarget ? "Under target ✓" : "Over target"}
            </Text>
          </View>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: "900", marginTop: 6 }}>
            {formatHm(today.minutesUsed)}
            <Text style={{ color: C.dim, fontSize: 15, fontWeight: "600" }}> of {formatHm(today.targetMin)} target</Text>
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={styles.dim}>{pct}% of daily target used · potential +{rank.potentialTodayXp} XP tonight</Text>

          {today.topApps.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.dim}>Top apps (from your phone)</Text>
              {today.topApps.map((app, i) => (
                <View key={`${app.name}-${i}`} style={styles.appRow}>
                  <Text style={{ color: C.text, flex: 1 }} numberOfLines={1}>{app.name}</Text>
                  <Text style={{ color: C.dim }}>{formatHm(app.minutes)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* sync */}
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, !permitted && { opacity: 0.6 }]}
          onPress={syncNow}
          disabled={syncing}
        >
          {syncing ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.primaryText}>🔄 Sync real screen time now</Text>
          )}
        </Pressable>
        <Text style={[styles.dim, { textAlign: "center", marginTop: 8, fontSize: 12 }]}>
          {lastSync ? `Last sync ${lastSync.toLocaleTimeString()}` : "Pull down to refresh · auto-syncs hourly in background"}
        </Text>
        {message ? <Text style={styles.hint}>{message}</Text> : null}

        {/* week strip */}
        <View style={styles.card}>
          <Text style={{ color: C.text, fontWeight: "800", marginBottom: 10 }}>Last 7 days</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {me.history.slice(0, 7).reverse().map((d) => (
              <View key={d.date} style={{ alignItems: "center" }}>
                <View style={[styles.dayDot, { backgroundColor: d.metTarget ? C.green : C.red, opacity: 0.35 + Math.min(0.65, d.minutesUsed / Math.max(1, d.targetMin)) }]} />
                <Text style={styles.dim, { color: C.dim, fontSize: 10, marginTop: 4 }}>{d.date.slice(8)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- helpers ----------
function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollPad: { padding: 18, paddingBottom: 48 },
  brand: { color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: 0.5 },
  dim: { color: C.dim, fontSize: 13 },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  progressTrack: {
    height: 8,
    backgroundColor: C.cardAlt,
    borderRadius: 4,
    marginTop: 12,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4 },
  appRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  primaryBtn: {
    backgroundColor: C.accentSoft,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  fieldLabel: { color: C.dim, fontSize: 12, marginBottom: 6, fontWeight: "700" },
  input: {
    backgroundColor: C.cardAlt,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 8 : 12,
    fontSize: 15,
  },
  error: { color: C.red, fontSize: 13, marginBottom: 10 },
  hint: {
    color: C.amber,
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  dayDot: { width: 26, height: 26, borderRadius: 13 },
});
