import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListHatchingCyclesQueryKey,
  useCreateHatchingCycle,
  useDeleteHatchingCycle,
  useListHatchingCycles,
  useUpdateHatchingCycle,
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

const STATUS_AR: Record<string, string> = {
  incubating: "تحت التفقيس",
  hatching: "يفقس الآن",
  completed: "مكتمل",
  failed: "فشل",
};
const STATUS_COLOR: Record<string, string> = {
  incubating: "#E6A817",
  hatching: "#6B9E5B",
  completed: "#7B68EE",
  failed: "#C0392B",
};

function getDaysSince(dateStr: string) {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function CycleCard({ cycle, onDelete }: { cycle: any; onDelete: (id: number) => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const updateCycle = useUpdateHatchingCycle();
  const badgeColor = STATUS_COLOR[cycle.status] ?? colors.primary;
  const days = getDaysSince(cycle.startDate);
  const progress = Math.min(days / 21, 1);
  const hatchRate = cycle.eggsHatched != null ? Math.round((cycle.eggsHatched / cycle.eggsSet) * 100) : null;

  const markCompleted = () => {
    Alert.prompt("نتيجة التفقيس", "كم عدد البيض الذي فقس؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حفظ",
        onPress: (val) => {
          const hatched = parseInt(val ?? "0");
          updateCycle.mutate(
            { id: cycle.id, data: { ...cycle, status: "completed", eggsHatched: hatched, actualHatchDate: new Date().toISOString().split("T")[0] } },
            { onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() }); } }
          );
        }
      }
    ], "plain-text");
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(cycle.status === "incubating" || cycle.status === "hatching") && (
            <Pressable onPress={markCompleted} style={[styles.actionBtn, { backgroundColor: "#E8F5E4" }]}>
              <Feather name="check" size={14} color={colors.success} />
            </Pressable>
          )}
          <Pressable onPress={() => onDelete(cycle.id)} style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.cycleName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{cycle.batchName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColor + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
            <Text style={[styles.statusText, { color: badgeColor, fontFamily: "Inter_600SemiBold" }]}>{STATUS_AR[cycle.status]}</Text>
          </View>
        </View>
      </View>

      <View style={styles.eggsRow}>
        <View style={[styles.eggStat, { backgroundColor: colors.secondary }]}>
          <Feather name="circle" size={14} color="#E6A817" />
          <Text style={[styles.eggNum, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{cycle.eggsSet}</Text>
          <Text style={[styles.eggLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>بيضة</Text>
        </View>
        {cycle.eggsHatched != null && (
          <View style={[styles.eggStat, { backgroundColor: "#E8F5E4" }]}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.eggNum, { color: colors.success, fontFamily: "Inter_700Bold" }]}>{cycle.eggsHatched}</Text>
            <Text style={[styles.eggLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>فقست</Text>
          </View>
        )}
        {hatchRate != null && (
          <View style={[styles.eggStat, { backgroundColor: colors.secondary }]}>
            <Feather name="trending-up" size={14} color={colors.primary} />
            <Text style={[styles.eggNum, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{hatchRate}%</Text>
            <Text style={[styles.eggLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>نسبة</Text>
          </View>
        )}
      </View>

      {cycle.status !== "completed" && cycle.status !== "failed" && (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>اليوم {days} من 21</Text>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              متبقي {Math.max(0, 21 - days)} يوم
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: badgeColor }]} />
          </View>
        </View>
      )}

      <Text style={[styles.dateInfo, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        بدأ: {cycle.startDate} · موعد التفقيس: {cycle.expectedHatchDate}
      </Text>
    </View>
  );
}

function AddCycleModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const createCycle = useCreateHatchingCycle();
  const [name, setName] = useState("");
  const [eggs, setEggs] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const insets = useSafeAreaInsets();

  const expectedDate = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  };

  const submit = () => {
    if (!name.trim() || !eggs) { Alert.alert("تنبيه", "يرجى ملء جميع الحقول"); return; }
    createCycle.mutate(
      { data: { batchName: name.trim(), eggsSet: parseInt(eggs), startDate, expectedHatchDate: expectedDate(), status: "incubating" } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() });
          setName(""); setEggs("");
          onClose();
        },
        onError: () => Alert.alert("خطأ", "فشل في إضافة دورة التفقيس"),
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>دورة تفقيس جديدة</Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>اسم الدفعة *</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="مثال: الدفعة الثالثة" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} textAlign="right" />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>عدد البيض *</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="400" placeholderTextColor={colors.mutedForeground} value={eggs} onChangeText={setEggs} keyboardType="number-pad" textAlign="right" />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>تاريخ البدء</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} textAlign="right" />

          {eggs && startDate && (
            <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text, fontFamily: "Inter_400Regular" }]}>
                موعد التفقيس المتوقع: {expectedDate()}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 16 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>إلغاء</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}>
              {createCycle.isPending ? <ActivityIndicator color="#fff" /> :
                <Text style={[styles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>إضافة</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HatchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: cycles, isLoading, refetch } = useListHatchingCycles();
  const deleteCycle = useDeleteHatchingCycle();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const active = cycles?.filter(c => c.status === "incubating" || c.status === "hatching") ?? [];
  const past = cycles?.filter(c => c.status === "completed" || c.status === "failed") ?? [];

  const handleDelete = (id: number) => {
    Alert.alert("حذف الدورة", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteCycle.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() }) }) }
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.pageTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>الفقاسة</Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
          {active.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>نشطة</Text>
              {active.map(c => <CycleCard key={c.id} cycle={c} onDelete={handleDelete} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>سابقة</Text>
              {past.map(c => <CycleCard key={c.id} cycle={c} onDelete={handleDelete} />)}
            </>
          )}
          {cycles?.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="sun" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>لا توجد دورات تفقيس</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>أضف أول دورة تفقيس</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Pressable style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAdd(true); }}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <AddCycleModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 26, textAlign: "right" },
  groupLabel: { fontSize: 13, textAlign: "right", marginBottom: 8, marginTop: 4 },
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cycleName: { fontSize: 17, marginBottom: 4 },
  statusBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-end" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12 },
  eggsRow: { flexDirection: "row-reverse", gap: 8 },
  eggStat: { flex: 1, alignItems: "center", padding: 10, borderRadius: 12, gap: 2 },
  eggNum: { fontSize: 18 },
  eggLabel: { fontSize: 11 },
  progressLabel: { fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  dateInfo: { fontSize: 12, textAlign: "right", marginTop: 10 },
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
  infoBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginBottom: 8 },
  infoText: { fontSize: 13 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 15 },
});
