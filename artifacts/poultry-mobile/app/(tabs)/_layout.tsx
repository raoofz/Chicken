import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>الرئيسية</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chickens">
        <Icon sf={{ default: "bird", selected: "bird.fill" }} />
        <Label>الدجاجات</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="hatching">
        <Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
        <Label>الفقاسة</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks">
        <Icon sf={{ default: "checklist", selected: "checklist" }} />
        <Label>المهام</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <Icon sf={{ default: "target", selected: "target" }} />
        <Label>الأهداف</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabIcon = (name: string, sfName: string, color: string, size: number) =>
    isIOS ? <SymbolView name={sfName} tintColor={color} size={size} /> : <Feather name={name as any} size={size} color={color} />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: isWeb ? 0 : 4 },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, size }) => tabIcon("home", "house", color, size),
        }}
      />
      <Tabs.Screen
        name="chickens"
        options={{
          title: "الدجاجات",
          tabBarIcon: ({ color, size }) => tabIcon("users", "bird", color, size),
        }}
      />
      <Tabs.Screen
        name="hatching"
        options={{
          title: "الفقاسة",
          tabBarIcon: ({ color, size }) => tabIcon("sun", "sun.max", color, size),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "المهام",
          tabBarIcon: ({ color, size }) => tabIcon("check-square", "checklist", color, size),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "الأهداف",
          tabBarIcon: ({ color, size }) => tabIcon("target", "target", color, size),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
