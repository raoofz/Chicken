import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTasksQueryKey,
  useGetDashboardSummary,
  useGetTodayTasks,
  useUpdateTask,
} from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/XXXXXXXXXX";

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function formatDateAr(d: Date) {
  return `${DAYS_AR[d.getDay()]}, ${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`;
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: string | number; icon: string; color: string; bg: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, logout, isAdmin } = useAuth();
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: tasks, isLoading: loadingTasks, refetch: refetchTasks } = useGetTodayTasks();
  const updateTask = useUpdateTask();

  const isRefreshing = false;
  const onRefresh = () => { refetchSummary(); refetchTasks(); };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toggleTask = (id: number, completed: boolean) => {
    updateTask.mutate(
      { id, data: { completed: !completed } },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); refetchTasks(); refetchSummary(); } }
    );
  };

  const categoryIcon: Record<string, string> = {
    feeding: "droplet", health: "heart", cleaning: "wind", hatching: "sun", other: "circle",
  };
  const priorityColor: Record<string, string> = {
    high: colors.destructive, medium: colors.warning, low: colors.success,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج؟", [
              { text: "إلغاء", style: "cancel" },
              { text: "خروج", style: "destructive", onPress: logout },
            ])}
            style={[styles.logoutBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(WHATSAPP_GROUP_URL)}
            style={[styles.logoutBtn, { backgroundColor: "#25D36622" }]}
          >
            <Feather name="message-circle" size={16} color="#25D366" />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
            <Text style={[styles.greeting, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
              {user?.name ?? "المستخدم"}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: isAdmin ? "#B85C2A22" : "#6B9E5B22" }]}>
              <Text style={[styles.roleText, { color: isAdmin ? "#B85C2A" : "#6B9E5B", fontFamily: "Inter_600SemiBold" }]}>
                {isAdmin ? "مدير" : "عامل"}
              </Text>
            </View>
          </View>
          <Text style={[styles.dateText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{formatDateAr(new Date())}</Text>
        </View>
      </View>

      {loadingSummary ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="إجمالي الدجاجات" value={summary?.totalChickens ?? 0} icon="users" color={colors.primary} bg={colors.secondary} />
          <StatCard label="القطعان" value={summary?.totalFlocks ?? 0} icon="grid" color={colors.accent} bg="#F5E6D3" />
          <StatCard label="بيض التفقيس" value={summary?.totalEggsIncubating ?? 0} icon="circle" color="#E6A817" bg="#FFF3CC" />
          <StatCard label="نسبة التفقيس" value={`${summary?.overallHatchRate ?? 0}%`} icon="trending-up" color={colors.success} bg="#E8F5E4" />
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>مهام اليوم</Text>
          <View style={[styles.badge, { backgroundColor: summary?.tasksCompletedToday === summary?.tasksDueToday && (summary?.tasksDueToday ?? 0) > 0 ? colors.success : colors.primary }]}>
            <Text style={[styles.badgeText, { fontFamily: "Inter_600SemiBold" }]}>
              {summary?.tasksCompletedToday ?? 0}/{summary?.tasksDueToday ?? 0}
            </Text>
          </View>
        </View>

        {loadingTasks ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
        ) : tasks?.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>لا توجد مهام اليوم</Text>
          </View>
        ) : (
          tasks?.map((task) => (
            <Pressable
              key={task.id}
              style={[styles.taskRow, { borderBottomColor: colors.border }]}
              onPress={() => toggleTask(task.id, task.completed)}
            >
              <View style={[styles.taskCheck, {
                borderColor: task.completed ? colors.success : colors.border,
                backgroundColor: task.completed ? colors.success : "transparent",
              }]}>
                {task.completed && <Feather name="check" size={12} color="#fff" />}
              </View>
              <Feather name={categoryIcon[task.category] as any ?? "circle"} size={16} color={colors.mutedForeground} style={{ marginHorizontal: 8 }} />
              <Text style={[styles.taskTitle, {
                color: task.completed ? colors.mutedForeground : colors.text,
                textDecorationLine: task.completed ? "line-through" : "none",
                fontFamily: "Inter_500Medium",
                flex: 1,
              }]}>{task.title}</Text>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor[task.priority] ?? colors.muted }]} />
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 12 }]}>الفقاسة النشطة</Text>
        {(summary?.activeHatchingCycles ?? 0) > 0 ? (
          <View style={[styles.hatchCard, { backgroundColor: colors.secondary }]}>
            <Feather name="sun" size={24} color={colors.warning} />
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.hatchLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                {summary?.totalEggsIncubating} بيضة قيد التفقيس
              </Text>
              <Text style={[styles.hatchSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {summary?.activeHatchingCycles} دورة نشطة
              </Text>
            </View>
            <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="sun" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>لا توجد دورات تفقيس نشطة</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logoutBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleText: { fontSize: 11 },
  greeting: { fontSize: 15 },
  dateText: { fontSize: 12, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, marginBottom: 16 },
  statCard: {
    width: "46%", flex: 1, borderRadius: 14, padding: 14, alignItems: "flex-end",
    borderWidth: 1, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 12 },
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 12 },
  sectionTitle: { fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: "#fff", fontSize: 12 },
  taskRow: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 14 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { alignItems: "center", padding: 24, gap: 8 },
  emptyText: { fontSize: 14 },
  hatchCard: { flexDirection: "row-reverse", alignItems: "center", padding: 14, borderRadius: 12, margin: 12, marginTop: 0 },
  hatchLabel: { fontSize: 15 },
  hatchSub: { fontSize: 13, marginTop: 2 },
});
