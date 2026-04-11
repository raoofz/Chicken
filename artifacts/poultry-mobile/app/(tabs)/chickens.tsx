import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListFlocksQueryKey,
  useCreateFlock,
  useDeleteFlock,
  useListFlocks,
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

const PURPOSE_AR: Record<string, string> = {
  eggs: "إنتاج بيض",
  meat: "تسمين",
  hatching: "تفقيس",
  mixed: "متعدد",
};
const PURPOSE_COLOR: Record<string, string> = {
  eggs: "#E6A817",
  meat: "#C0392B",
  hatching: "#6B9E5B",
  mixed: "#7B68EE",
};

function FlockCard({ flock, onDelete, isAdmin }: { flock: any; onDelete: (id: number) => void; isAdmin: boolean }) {
  const colors = useColors();
  const badgeColor = PURPOSE_COLOR[flock.purpose] ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        {isAdmin && (
          <Pressable onPress={() => onDelete(flock.id)} style={[styles.deleteBtn, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </Pressable>
        )}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.flockName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{flock.name}</Text>
          <Text style={[styles.flockBreed, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{flock.breed}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
          <Feather name="users" size={14} color={colors.primary} />
          <Text style={[styles.chipText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{flock.count} دجاجة</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
          <Feather name="calendar" size={14} color={colors.accent} />
          <Text style={[styles.chipText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{flock.ageDays} يوم</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: badgeColor + "20" }]}>
          <Text style={[styles.chipText, { color: badgeColor, fontFamily: "Inter_600SemiBold" }]}>{PURPOSE_AR[flock.purpose]}</Text>
        </View>
      </View>
      {flock.notes ? (
        <Text style={[styles.notes, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{flock.notes}</Text>
      ) : null}
    </View>
  );
}

function AddFlockModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const createFlock = useCreateFlock();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [count, setCount] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [purpose, setPurpose] = useState<"eggs" | "meat" | "hatching" | "mixed">("eggs");
  const [notes, setNotes] = useState("");

  const reset = () => { setName(""); setBreed(""); setCount(""); setAgeDays(""); setPurpose("eggs"); setNotes(""); };

  const submit = () => {
    if (!name.trim() || !breed.trim() || !count || !ageDays) {
      Alert.alert("تنبيه", "يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    createFlock.mutate(
      { data: { name: name.trim(), breed: breed.trim(), count: parseInt(count), ageDays: parseInt(ageDays), purpose, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListFlocksQueryKey() });
          reset();
          onClose();
        },
        onError: () => Alert.alert("خطأ", "فشل في إضافة القطيع"),
      }
    );
  };

  const insets = useSafeAreaInsets();
  const purposes: Array<"eggs" | "meat" | "hatching" | "mixed"> = ["eggs", "meat", "hatching", "mixed"];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>إضافة دجاجات جديدة</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>الاسم *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="اسم القطيع" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} textAlign="right" />

            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>السلالة *</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="مثال: عرب بلدي" placeholderTextColor={colors.mutedForeground} value={breed} onChangeText={setBreed} textAlign="right" />

            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>العدد *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="127" placeholderTextColor={colors.mutedForeground} value={count} onChangeText={setCount} keyboardType="number-pad" textAlign="right" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>العمر (أيام) *</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="35" placeholderTextColor={colors.mutedForeground} value={ageDays} onChangeText={setAgeDays} keyboardType="number-pad" textAlign="right" />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>الغرض</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {purposes.map((p) => (
                <Pressable key={p} onPress={() => setPurpose(p)}
                  style={[styles.purposeChip, { backgroundColor: purpose === p ? colors.primary : colors.secondary, borderColor: purpose === p ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: purpose === p ? "#fff" : colors.text, fontFamily: "Inter_500Medium" }]}>{PURPOSE_AR[p]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>ملاحظات</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="ملاحظات اختيارية..." placeholderTextColor={colors.mutedForeground} value={notes} onChangeText={setNotes} multiline textAlign="right" textAlignVertical="top" />
          </ScrollView>

          <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 16 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.secondary, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>إلغاء</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 2 }]}>
              {createFlock.isPending ? <ActivityIndicator color="#fff" /> :
                <Text style={[styles.btnText, { color: "#fff", fontFamily: "Inter_600SemiBold" }]}>إضافة</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ChickensScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { data: flocks, isLoading, refetch } = useListFlocks();
  const deleteFlock = useDeleteFlock();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalChickens = flocks?.reduce((sum, f) => sum + f.count, 0) ?? 0;

  const handleDelete = (id: number) => {
    Alert.alert("حذف القطيع", "هل أنت متأكد من حذف هذا القطيع؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: () => deleteFlock.mutate({ id }, {
          onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); qc.invalidateQueries({ queryKey: getListFlocksQueryKey() }); }
        })
      }
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>الدجاجات</Text>
          <View style={[styles.totalBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.totalText, { fontFamily: "Inter_600SemiBold" }]}>المجموع: {totalChickens}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : flocks?.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="users" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>لا توجد دجاجات</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>أضف أول قطيع لك</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
          {flocks?.map((f) => <FlockCard key={f.id} flock={f} onDelete={handleDelete} isAdmin={isAdmin} />)}
        </ScrollView>
      )}

      {isAdmin && (
        <Pressable style={[styles.fab, { backgroundColor: colors.primary, bottom: (Platform.OS === "web" ? 34 : insets.bottom) + 80 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAdd(true); }}>
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      )}

      <AddFlockModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitle: { fontSize: 26 },
  totalBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  totalText: { color: "#fff", fontSize: 14 },
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row-reverse", alignItems: "flex-start", marginBottom: 12, gap: 8 },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  flockName: { fontSize: 17 },
  flockBreed: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  statChip: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 13 },
  notes: { fontSize: 13, marginTop: 10, lineHeight: 20 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
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
  label: { fontSize: 13, textAlign: "right", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 14 },
  textArea: { height: 80 },
  purposeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 15 },
});
