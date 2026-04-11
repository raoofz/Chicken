import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTasksQueryKey,
  useCreateTask,
  useDeleteTask,
  useListTasks,
  useUpdateTask,
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

const CATEGORY_AR: Record<string, string> = {
  feeding: "التغذية",
  health: "الصحة",
  cleaning: "النظافة",
  hatching: "التفقيس",
  other: "أخرى",
};
const CATEGORY_ICON: Record<string, string> = {
  feeding: "droplet",
  health: "heart",
  cleaning: "wind",
  hatching: "sun",
  other: "circle",
};
const PRIORITY_AR: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية" };
const PRIORITY_COLOR: Record<string, string> = {};

function TaskItem({ task, onToggle, onDelete }: { task: any; onToggle: () => void; onDelete: () => void }) {
  const colors = useColors();
  const priorityColors: Record<string, string> = { high: colors.destructive, medium: colors.warning, low: colors.success };
  const pc = priorityColors[task.priority] ?? colors.mutedForeground;

  return (
    <View style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: task.completed ? 0.7 : 1 }]}>
      <Pressable onPress={onToggle} style={[styles.checkbox, {
        borderColor: task.completed ? colors.success : colors.border,
        backgroundColor: task.completed ? colors.success : "transparent",
      }]}>
        {task.completed && <Feather name="check" size={13} color="#fff" />}
      </Pressable>

      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Text style={[styles.taskTitle, {
          color: task.completed ? colors.mutedForeground : colors.text,
          fontFamily: "Inter_600SemiBold",
          textDecorationLine: task.completed ? "line-through" : "none",
        }]}>{task.title}</Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 4 }}>
          <View style={[styles.catBadge, { backgroundColor: colors.secondary }]}>
            <Feather name={CATEGORY_ICON[task.category] as any} size={11} color={colors.mutedForeground} />
            <Text style={[styles.catText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{CATEGORY_AR[task.category]}</Text>
          </View>
          <View style={[styles.priBadge, { backgroundColor: pc + "20" }]}>
            <Text style={[styles.catText, { color: pc, fontFamily: "Inter_600SemiBold" }]}>{PRIORITY_AR[task.priority]}</Text>
          </View>
          {task.dueDate && (
            <Text style={[styles.dueDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{task.dueDate}</Text>
          )}
        </View>
      </View>

      <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

function AddTaskModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const createTask = useCreateTask();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"feeding" | "health" | "cleaning" | "hatching" | "other">("feeding");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  const cats: Array<"feeding" | "health" | "cleaning" | "hatching" | "other"> = ["feeding", "health", "cleaning", "hatching", "other"];
  const pris: Array<"low" | "medium" | "high"> = ["high", "medium", "low"];
  const priColors: Record<string, string> = { high: colors.destructive, medium: colors.warning, low: colors.success };

  const submit = () => {
    if (!title.trim()) { Alert.alert("تنبيه", "يرجى إدخال عنوان المهمة"); return; }
    createTask.mutate(
      { data: { title: title.trim(), category, priority, dueDate } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          setTitle("");
          onClose();
        },
        onError: () => Alert.alert("خطأ", "فشل في إضافة المهمة"),
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>مهمة جديدة</Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>العنوان *</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="وصف المهمة..." placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} textAlign="right" autoFocus />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>الفئة</Text>
          <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {cats.map(c => (
              <Pressable key={c} onPress={() => setCategory(c)}
                style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.secondary, borderColor: category === c ? colors.primary : colors.border }]}>
                <Text style={[styles.chipText, { color: category === c ? "#fff" : colors.text, fontFamily: "Inter_500Medium" }]}>{CATEGORY_AR[c]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>الأولوية</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 14 }}>
            {pris.map(p => (
              <Pressable key={p} onPress={() => setPriority(p)}
                style={[styles.chip, { flex: 1, backgroundColor: priority === p ? priColors[p] : colors.secondary, borderColor: priority === p ? priColors[p] : colors.border }]}>
                <Text style={[styles.chipText, { color: priority === p ? "#fff" : colors.text, fontFamily: "Inter_600SemiBold" }]}>{PRIORITY_AR[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>تاريخ الاستحقاق</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} textAlign="right" />

          <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 8 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>إلغاء</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}>
              {createTask.isPending ? <ActivityIndicator color="#fff" /> :
                <Text style={[styles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>إضافة</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const today = new Date().toISOString().split("T")[0];
  const { data: tasks, isLoading, refetch } = useListTasks({ params: { date: today } });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const completed = tasks?.filter(t => t.completed) ?? [];
  const pending = tasks?.filter(t => !t.completed) ?? [];

  const toggle = (id: number, done: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask.mutate({ id, data: { completed: !done } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }) });
  };
  const remove = (id: number) => {
    Alert.alert("حذف المهمة", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteTask.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }) }) }
    ]);
  };

  const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const d = new Date();
  const todayLabel = `${DAYS_AR[d.getDay()]} ${d.getDate()} ${MONTHS_AR[d.getMonth()]}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>المهام</Text>
          <Text style={[styles.dateLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{todayLabel}</Text>
        </View>
        {tasks && (
          <View style={[styles.progressRow, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { width: `${tasks.length ? (completed.length / tasks.length) * 100 : 0}%` as any, backgroundColor: colors.success }]} />
          </View>
        )}
        <Text style={[styles.progressText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {completed.length} من {tasks?.length ?? 0} مهام مكتملة
        </Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
          {pending.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>قيد التنفيذ ({pending.length})</Text>
              {pending.map(t => <TaskItem key={t.id} task={t} onToggle={() => toggle(t.id, t.completed)} onDelete={() => remove(t.id)} />)}
            </>
          )}
          {completed.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 8 }]}>مكتملة ({completed.length})</Text>
              {completed.map(t => <TaskItem key={t.id} task={t} onToggle={() => toggle(t.id, t.completed)} onDelete={() => remove(t.id)} />)}
            </>
          )}
          {tasks?.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>لا توجد مهام اليوم</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>أضف مهمة جديدة</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Pressable style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAdd(true); }}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddTaskModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 26 },
  dateLabel: { fontSize: 14 },
  progressRow: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 12, marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 12, textAlign: "right" },
  groupLabel: { fontSize: 15, textAlign: "right", marginBottom: 10 },
  taskCard: {
    flexDirection: "row-reverse", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 15 },
  catBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11 },
  priBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  dueDate: { fontSize: 11 },
  deleteBtn: { padding: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, textAlign: "right", marginBottom: 20 },
  label: { fontSize: 13, textAlign: "right", marginBottom: 6, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: "center" },
  chipText: { fontSize: 13 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 15 },
});
