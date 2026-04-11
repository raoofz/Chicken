import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password.trim());
    } catch (err: any) {
      Alert.alert("خطأ", err.message ?? "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
    logo: { alignItems: "center", marginBottom: 40 },
    logoCircle: { width: 100, height: 100, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    logoEmoji: { fontSize: 52 },
    appName: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center" },
    appSub: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", marginTop: 6, fontFamily: "Inter_400Regular" },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
    cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.text, textAlign: "center", marginBottom: 4 },
    cardSub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginBottom: 24, fontFamily: "Inter_400Regular" },
    label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.text, marginBottom: 8, textAlign: "right" },
    inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, marginBottom: 16, paddingHorizontal: 14, height: 52 },
    input: { flex: 1, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "right" },
    showBtn: { padding: 4 },
    showBtnTxt: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    loginBtn: { backgroundColor: "#B85C2A", borderRadius: 12, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
    loginBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
    hint: { marginTop: 20, backgroundColor: colors.muted, borderRadius: 12, padding: 14 },
    hintTitle: { fontSize: 12, color: colors.mutedForeground, textAlign: "center", fontFamily: "Inter_600SemiBold", marginBottom: 8 },
    hintRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    hintLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    hintCode: { fontSize: 12, color: "#B85C2A", fontFamily: "Inter_600SemiBold", backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  });

  return (
    <View style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logo}>
            <View style={s.logoCircle}>
              <Text style={s.logoEmoji}>🐔</Text>
            </View>
            <Text style={s.appName}>مدير المزرعة</Text>
            <Text style={s.appSub}>نظام إدارة الدواجن الذكي</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>تسجيل الدخول</Text>
            <Text style={s.cardSub}>أدخل بيانات حسابك للوصول إلى النظام</Text>

            <Text style={s.label}>اسم المستخدم</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                placeholder="أدخل اسم المستخدم"
                placeholderTextColor={colors.mutedForeground}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                textAlign="right"
              />
            </View>

            <Text style={s.label}>كلمة المرور</Text>
            <View style={s.inputWrap}>
              <Pressable style={s.showBtn} onPress={() => setShowPass(!showPass)}>
                <Text style={s.showBtnTxt}>{showPass ? "إخفاء" : "إظهار"}</Text>
              </Pressable>
              <TextInput
                style={s.input}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                textAlign="right"
              />
            </View>

            <Pressable
              style={[s.loginBtn, (loading || !username || !password) && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.loginBtnText}>دخول</Text>
              )}
            </Pressable>

            <View style={s.hint}>
              <Text style={s.hintTitle}>بيانات الدخول الافتراضية</Text>
              <View style={s.hintRow}>
                <Text style={s.hintCode}>admin / admin123</Text>
                <Text style={s.hintLabel}>مدير:</Text>
              </View>
              <View style={s.hintRow}>
                <Text style={s.hintCode}>worker / worker123</Text>
                <Text style={s.hintLabel}>عامل:</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
