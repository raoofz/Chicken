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
import { useAuth } from "@/contexts/AuthContext";

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

function PhaseRow({ label, temp, humidity, date, time, color }: { label: string; temp?: number | null; humidity?: number | null; date?: string | null; time?: string | null; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.phaseRow, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      <Text style={[styles.phaseLabel, { color, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {date && (
          <View style={styles.phasePill}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{date}</Text>
            {time && <Text style={[styles.pillText, { color: colors.mutedForeground }]}>{time}</Text>}
          </View>
        )}
        {temp != null && (
          <View style={styles.phasePill}>
            <Feather name="thermometer" size={11} color="#E74C3C" />
            <Text style={[styles.pillText, { color: colors.text }]}>{temp}°م</Text>
          </View>
        )}
        {humidity != null && (
          <View style={styles.phasePill}>
            <Feather name="droplet" size={11} color="#3498DB" />
            <Text style={[styles.pillText, { color: colors.text }]}>{humidity}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CycleCard({ cycle, onDelete, isAdmin }: { cycle: any; onDelete: (id: number) => void; isAdmin: boolean }) {
  const colors = useColors();
  const qc = useQueryClient();
  const updateCycle = useUpdateHatchingCycle();
  const badgeColor = STATUS_COLOR[cycle.status] ?? colors.primary;
  const days = getDaysSince(cycle.startDate);
  const progress = Math.min(days / 21, 1);
  const hatchRate = cycle.eggsHatched != null ? Math.round((cycle.eggsHatched / cycle.eggsSet) * 100) : null;
  const isLockdown = days >= 18 && (cycle.status === "incubating" || cycle.status === "hatching");

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
        {isAdmin && (
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
        )}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.cycleName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{cycle.batchName}</Text>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 4 }}>
            <View style={[styles.statusBadge, { backgroundColor: badgeColor + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
              <Text style={[styles.statusText, { color: badgeColor, fontFamily: "Inter_600SemiBold" }]}>{STATUS_AR[cycle.status]}</Text>
            </View>
            {isLockdown && (
              <View style={[styles.statusBadge, { backgroundColor: "#FF6B3520" }]}>
                <Text style={[styles.statusText, { color: "#FF6B35", fontFamily: "Inter_600SemiBold" }]}>مرحلة الإقفال</Text>
              </View>
            )}
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

      {/* Phase 1 */}
      <PhaseRow
        label="التحضين (1–18)"
        temp={cycle.temperature}
        humidity={cycle.humidity}
        date={cycle.startDate}
        time={cycle.setTime}
        color="#3498DB"
      />

      {/* Phase 2 */}
      <PhaseRow
        label="الإقفال (18–21)"
        temp={cycle.lockdownTemperature}
        humidity={cycle.lockdownHumidity}
        date={cycle.lockdownDate}
        time={cycle.lockdownTime}
        color="#E67E22"
      />

      {cycle.status !== "completed" && cycle.status !== "failed" && (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              اليوم {days} من 21 {days >= 18 ? "🔒" : ""}
            </Text>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              متبقي {Math.max(0, 21 - days)} يوم
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[
              styles.progressFill,
              {
                width: `${Math.min((days / 18) * 100, 100)}%` as any,
                backgroundColor: days >= 18 ? "#E67E22" : "#3498DB"
              }
            ]} />
          </View>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ fontSize: 10, color: "#3498DB", fontFamily: "Inter_400Regular" }}>تحضين</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 10, color: "#E67E22", fontFamily: "Inter_400Regular" }}>إقفال</Text>
              <View style={{ width: 1, height: 8, backgroundColor: colors.border, marginHorizontal: 4 }} />
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>اليوم 18</Text>
            </View>
          </View>
        </View>
      )}

      {cycle.actualHatchDate && (
        <Text style={[styles.dateInfo, { color: colors.success, fontFamily: "Inter_400Regular" }]}>
          ✓ فقس فعلياً: {cycle.actualHatchDate}
        </Text>
      )}
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
  const [setTime, setSetTime] = useState("");
  const [temp1, setTemp1] = useState("37.8");
  const [humidity1, setHumidity1] = useState("56");
  const [temp2, setTemp2] = useState("37.2");
  const [humidity2, setHumidity2] = useState("70");
  const insets = useSafeAreaInsets();

  const getDate = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const submit = () => {
    if (!name.trim() || !eggs) { Alert.alert("تنبيه", "يرجى ملء اسم الدفعة وعدد البيض"); return; }
    createCycle.mutate(
      {
        data: {
          batchName: name.trim(),
          eggsSet: parseInt(eggs),
          startDate,
          setTime: setTime || undefined,
          expectedHatchDate: getDate(21),
          lockdownDate: getDate(18),
          status: "incubating",
          temperature: temp1 ? parseFloat(temp1) : undefined,
          humidity: humidity1 ? parseFloat(humidity1) : undefined,
          lockdownTemperature: temp2 ? parseFloat(temp2) : undefined,
          lockdownHumidity: humidity2 ? parseFloat(humidity2) : undefined,
        }
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListHatchingCyclesQueryKey() });
          setName(""); setEggs(""); setSetTime("");
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>دورة تفقيس جديدة</Text>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>اسم الدفعة *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="مثال: الدفعة الثالثة" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} textAlign="right" />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>عدد البيض *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="مثال: 400" placeholderTextColor={colors.mutedForeground} value={eggs} onChangeText={setEggs} keyboardType="number-pad" textAlign="right" />

            {/* Phase 1 */}
            <View style={[styles.phaseSection, { borderColor: "#3498DB40", backgroundColor: "#3498DB08" }]}>
              <Text style={[styles.phaseSectionTitle, { color: "#3498DB" }]}>المرحلة الأولى — تحضين (1–18)</Text>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>تاريخ الوضع</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>الساعة</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={setTime} onChangeText={setSetTime} placeholder="08:30" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
              </View>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>درجة الحرارة °م</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={temp1} onChangeText={setTemp1} keyboardType="decimal-pad" placeholder="37.8" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>الرطوبة %</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={humidity1} onChangeText={setHumidity1} keyboardType="decimal-pad" placeholder="56" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
              </View>
            </View>

            {/* Phase 2 */}
            <View style={[styles.phaseSection, { borderColor: "#E67E2240", backgroundColor: "#E67E2208" }]}>
              <Text style={[styles.phaseSectionTitle, { color: "#E67E22" }]}>المرحلة الثانية — إقفال وفقس (18–21)</Text>
              <Text style={[styles.phaseAutoNote, { color: colors.mutedForeground }]}>
                موعد الإقفال تلقائي: {startDate ? (() => { const d = new Date(startDate); d.setDate(d.getDate() + 18); return d.toISOString().split("T")[0]; })() : "--"}
              </Text>
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>درجة الحرارة °م</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={temp2} onChangeText={setTemp2} keyboardType="decimal-pad" placeholder="37.2" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>الرطوبة %</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={humidity2} onChangeText={setHumidity2} keyboardType="decimal-pad" placeholder="70" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                </View>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text, fontFamily: "Inter_400Regular" }]}>
                الدورة 21 يوم — تحضين 18 يوم ثم إقفال وفقس
              </Text>
            </View>

            <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 16 }}>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]}>
                <Text style={[styles.btnText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>إلغاء</Text>
              </Pressable>
              <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}>
                {createCycle.isPending ? <ActivityIndicator color="#fff" /> :
                  <Text style={[styles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>إضافة</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function HatchingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
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
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>دورة 21 يوم | تحضين ثم إقفال</Text>
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
          {active.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>نشطة</Text>
              {active.map(c => <CycleCard key={c.id} cycle={c} onDelete={handleDelete} isAdmin={isAdmin} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>سابقة</Text>
              {past.map(c => <CycleCard key={c.id} cycle={c} onDelete={handleDelete} isAdmin={isAdmin} />)}
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

      {isAdmin && (
        <Pressable style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAdd(true); }}>
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      )}

      <AddCycleModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 26, textAlign: "right" },
  pageSubtitle: { fontSize: 13, textAlign: "right", marginTop: 2 },
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
  eggsRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 10 },
  eggStat: { flex: 1, alignItems: "center", padding: 10, borderRadius: 12, gap: 2 },
  eggNum: { fontSize: 18 },
  eggLabel: { fontSize: 11 },
  phaseRow: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 8 },
  phaseLabel: { fontSize: 12, textAlign: "right" },
  phasePill: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 11 },
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
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, textAlign: "right", marginBottom: 20 },
  label: { fontSize: 13, textAlign: "right", marginBottom: 6, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 14 },
  phaseSection: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  phaseSectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "right", marginBottom: 10 },
  phaseAutoNote: { fontSize: 12, textAlign: "right", marginBottom: 8 },
  infoBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginBottom: 8 },
  infoText: { fontSize: 13 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 15 },
});
