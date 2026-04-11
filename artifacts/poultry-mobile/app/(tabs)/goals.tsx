import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListGoalsQueryKey,
  useCreateGoal,
  useDeleteGoal,
  useListGoals,
  useUpdateGoal,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORY_AR: Record<string, string> = {
  production: "الإنتاج",
  health: "الصحة",
  growth: "النمو",
  financial: "المالية",
  other: "أخرى",
};
const CATEGORY_ICON: Record<string, string> = {
  production: "package",
  health: "heart",
  growth: "trending-up",
  financial: "dollar-sign",
  other: "star",
};

function GoalCard({ goal, onDelete, onUpdate, isAdmin }: { goal: any; onDelete: (id: number) => void; onUpdate: (id: number, current: number) => void; isAdmin: boolean }) {
  const colors = useColors();
  const progress = Math.min(goal.currentValue / goal.targetValue, 1);
  const pct = Math.round(progress * 100);
  const icon = CATEGORY_ICON[goal.category] ?? "star";
  const isCompleted = goal.completed || goal.currentValue >= goal.targetValue;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isCompleted ? colors.success : colors.border }]}>
      <View style={styles.cardTop}>
        {isAdmin && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!isCompleted && (
              <Pressable onPress={() => onUpdate(goal.id, goal.currentValue)} style={[styles.actionBtn, { backgroundColor: colors.secondary }]}>
                <Feather name="edit-2" size={14} color={colors.primary} />
              </Pressable>
            )}
            <Pressable onPress={() => onDelete(goal.id)} style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </Pressable>
          </View>
        )}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
            <View style={[styles.iconWrap, { backgroundColor: isCompleted ? colors.success + "20" : colors.secondary }]}>
              <Feather name={icon as any} size={16} color={isCompleted ? colors.success : colors.primary} />
            </View>
            {isCompleted && (
              <View style={[styles.doneBadge, { backgroundColor: colors.success }]}>
                <Text style={[styles.doneBadgeText, { fontFamily: "Inter_600SemiBold" }]}>مكتمل</Text>
              </View>
            )}
          </View>
          <Text style={[styles.goalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{goal.title}</Text>
          {goal.description && (
            <Text style={[styles.goalDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{goal.description}</Text>
          )}
        </View>
      </View>

      <View style={styles.progressArea}>
        <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={[styles.progressValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {goal.currentValue} / {goal.targetValue} {goal.unit}
          </Text>
          <Text style={[styles.pct, { color: isCompleted ? colors.success : colors.primary, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.secondary }]}>
          <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: isCompleted ? colors.success : colors.primary }]} />
        </View>
      </View>

      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10 }}>
        <View style={[styles.catChip, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.catText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{CATEGORY_AR[goal.category]}</Text>
        </View>
        {goal.deadline && (
          <Text style={[styles.deadline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            <Feather name="calendar" size={11} /> {goal.deadline}
          </Text>
        )}
      </View>
    </View>
  );
}

function AddGoalModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const createGoal = useCreateGoal();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<"production" | "health" | "growth" | "financial" | "other">("production");
  const [deadline, setDeadline] = useState("");

  const cats: Array<"production" | "health" | "growth" | "financial" | "other"> = ["production", "health", "growth", "financial", "other"];

  const submit = () => {
    if (!title.trim() || !target || !unit.trim()) { Alert.alert("تنبيه", "يرجى ملء الحقول المطلوبة"); return; }
    createGoal.mutate(
      { data: { title: title.trim(), description: desc.trim() || undefined, targetValue: parseFloat(target), currentValue: parseFloat(current || "0"), unit: unit.trim(), category, deadline: deadline || undefined } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          setTitle(""); setDesc(""); setTarget(""); setCurrent("0"); setUnit(""); setDeadline("");
          onClose();
        },
        onError: () => Alert.alert("خطأ", "فشل في إضافة الهدف"),
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>هدف جديد</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>العنوان *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="مثال: إنتاج 100 بيضة أسبوعياً" placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} textAlign="right" />

            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>الهدف *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="100" placeholderTextColor={colors.mutedForeground} value={target} onChangeText={setTarget} keyboardType="decimal-pad" textAlign="right" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>الوحدة *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="بيضة" placeholderTextColor={colors.mutedForeground} value={unit} onChangeText={setUnit} textAlign="right" />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>الفئة</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {cats.map(c => (
                <Pressable key={c} onPress={() => setCategory(c)}
                  style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.secondary, borderColor: category === c ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: category === c ? "#fff" : colors.text, fontFamily: "Inter_500Medium" }]}>{CATEGORY_AR[c]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>الموعد النهائي</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD (اختياري)" placeholderTextColor={colors.mutedForeground} textAlign="right" />
          </ScrollView>

          <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 16 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>إلغاء</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}>
              {createGoal.isPending ? <ActivityIndicator color="#fff" /> :
                <Text style={[styles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>إضافة</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { data: goals, isLoading, refetch } = useListGoals();
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleDelete = (id: number) => {
    Alert.alert("حذف الهدف", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteGoal.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListGoalsQueryKey() }) }) }
    ]);
  };

  const handleUpdate = (id: number, current: number) => {
    Alert.prompt("تحديث التقدم", `القيمة الحالية: ${current}`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حفظ",
        onPress: (val) => {
          const newVal = parseFloat(val ?? String(current));
          if (isNaN(newVal)) return;
          updateGoal.mutate({ id, data: { currentValue: newVal } }, { onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: getListGoalsQueryKey() }); } });
        }
      }
    ], "plain-text", String(current));
  };

  const completed = goals?.filter(g => g.completed || g.currentValue >= g.targetValue) ?? [];
  const active = goals?.filter(g => !g.completed && g.currentValue < g.targetValue) ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>الأهداف</Text>
          <Text style={[styles.summary, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {completed.length} من {goals?.length ?? 0} مكتمل
          </Text>
        </View>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
          {active.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>جارية ({active.length})</Text>
              {active.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDelete} onUpdate={handleUpdate} isAdmin={isAdmin} />)}
            </>
          )}
          {completed.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>مكتملة ({completed.length})</Text>
              {completed.map(g => <GoalCard key={g.id} goal={g} onDelete={handleDelete} onUpdate={handleUpdate} isAdmin={isAdmin} />)}
            </>
          )}
          {goals?.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="target" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>لا توجد أهداف</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>أضف أول هدف لك</Text>
            </View>
          )}
        </ScrollView>
      )}

      {isAdmin && (
        <Pressable style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAdd(true); }}>
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      )}
      <AddGoalModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 26 },
  summary: { fontSize: 14 },
  groupLabel: { fontSize: 15, textAlign: "right", marginBottom: 10 },
  card: {
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  doneBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  doneBadgeText: { color: "#fff", fontSize: 12 },
  goalTitle: { fontSize: 16, textAlign: "right", marginTop: 6 },
  goalDesc: { fontSize: 13, textAlign: "right", marginTop: 4 },
  progressArea: { marginTop: 4 },
  progressValue: { fontSize: 14 },
  pct: { fontSize: 16 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  catText: { fontSize: 12 },
  deadline: { fontSize: 12 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, textAlign: "right", marginBottom: 20 },
  label: { fontSize: 13, textAlign: "right", marginBottom: 6, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: "center" },
  chipText: { fontSize: 13 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 15 },
});
