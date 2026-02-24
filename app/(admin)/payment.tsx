import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CreditCard,
  Check,
  TestTube,
  Rocket,
  AlertTriangle,
  Info,
  Save,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";

interface QNBConfig {
  id: string;
  mbr_id: string;
  is_test_mode: boolean;
  test_merchant_id: string;
  test_terminal_no: string;
  test_user_code: string;
  test_user_pass: string;
  test_merchant_pass: string;
  prod_merchant_id: string;
  prod_terminal_no: string;
  prod_user_code: string;
  prod_user_pass: string;
  prod_merchant_pass: string;
}

export default function AdminPaymentScreen() {
  const router = useRouter();
  // Payment Provider state
  const [activeProvider, setActiveProvider] = useState<"qnb" | "stripe">("qnb");
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  // QNB Config state
  const [qnbLoading, setQnbLoading] = useState(true);
  const [qnbSaving, setQnbSaving] = useState(false);
  const [qnbConfig, setQnbConfig] = useState<QNBConfig | null>(null);
  const [formData, setFormData] = useState({
    mbr_id: "5",
    is_test_mode: true,
    test_merchant_id: "085300000009704",
    test_terminal_no: "VS251939",
    test_user_code: "QNB_API_KULLANICI_3DPAY",
    test_user_pass: "UcBN0",
    test_merchant_pass: "12345678",
    prod_merchant_id: "",
    prod_terminal_no: "",
    prod_user_code: "",
    prod_user_pass: "",
    prod_merchant_pass: "",
  });

  useEffect(() => {
    fetchPaymentConfig();
    fetchQnbConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_provider_config")
        .select("*")
        .single();
      if (error) throw error;
      if (data) {
        const provider = data.active_provider === "sipay" ? "qnb" : data.active_provider;
        setActiveProvider(provider as "qnb" | "stripe");
      }
    } catch (error) {
      __DEV__ && console.log("Error fetching payment config:", error);
    } finally {
      setProviderLoading(false);
    }
  };

  const fetchQnbConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("qnb_config")
        .select("*")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        setQnbConfig(data as QNBConfig);
        setFormData({
          mbr_id: data.mbr_id || "5",
          is_test_mode: data.is_test_mode ?? true,
          test_merchant_id: data.test_merchant_id || "085300000009704",
          test_terminal_no: data.test_terminal_no || "VS251939",
          test_user_code: data.test_user_code || "QNB_API_KULLANICI_3DPAY",
          test_user_pass: data.test_user_pass || "UcBN0",
          test_merchant_pass: data.test_merchant_pass || "12345678",
          prod_merchant_id: data.prod_merchant_id || "",
          prod_terminal_no: data.prod_terminal_no || "",
          prod_user_code: data.prod_user_code || "",
          prod_user_pass: data.prod_user_pass || "",
          prod_merchant_pass: data.prod_merchant_pass || "",
        });
      }
    } catch (error) {
      __DEV__ && console.log("Error fetching QNB config:", error);
    } finally {
      setQnbLoading(false);
    }
  };

  const handleSaveProvider = async () => {
    setProviderSaving(true);
    try {
      const { data: existingConfig } = await supabase
        .from("payment_provider_config")
        .select("id")
        .single();

      if (existingConfig) {
        const { error } = await supabase
          .from("payment_provider_config")
          .update({ active_provider: activeProvider })
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payment_provider_config")
          .insert({ active_provider: activeProvider });
        if (error) throw error;
      }

      Alert.alert("Success", `Payment provider switched to ${activeProvider === "stripe" ? "Stripe" : "QNB POS"}`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update payment provider");
    } finally {
      setProviderSaving(false);
    }
  };

  const handleSaveQnb = async () => {
    setQnbSaving(true);
    try {
      const configData = {
        mbr_id: formData.mbr_id,
        is_test_mode: formData.is_test_mode,
        test_merchant_id: formData.test_merchant_id,
        test_terminal_no: formData.test_terminal_no,
        test_user_code: formData.test_user_code,
        test_user_pass: formData.test_user_pass,
        test_merchant_pass: formData.test_merchant_pass,
        prod_merchant_id: formData.prod_merchant_id,
        prod_terminal_no: formData.prod_terminal_no,
        prod_user_code: formData.prod_user_code,
        prod_user_pass: formData.prod_user_pass,
        prod_merchant_pass: formData.prod_merchant_pass,
        merchant_id: formData.is_test_mode ? formData.test_merchant_id : formData.prod_merchant_id,
        terminal_no: formData.is_test_mode ? formData.test_terminal_no : formData.prod_terminal_no,
        user_code: formData.is_test_mode ? formData.test_user_code : formData.prod_user_code,
        user_pass: formData.is_test_mode ? formData.test_user_pass : formData.prod_user_pass,
        merchant_pass: formData.is_test_mode ? formData.test_merchant_pass : formData.prod_merchant_pass,
      };

      if (qnbConfig?.id) {
        const { error } = await supabase
          .from("qnb_config")
          .update(configData)
          .eq("id", qnbConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("qnb_config").insert(configData);
        if (error) throw error;
      }

      Alert.alert("Success", "QNB POS configuration saved successfully");
      fetchQnbConfig();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save QNB configuration");
    } finally {
      setQnbSaving(false);
    }
  };

  const InputField = ({ label, value, onChangeText, placeholder, secureTextEntry, disabled, hint }: {
    label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
    secureTextEntry?: boolean; disabled?: boolean; hint?: string;
  }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: Colors.input,
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 10,
          padding: 10,
          fontSize: 14,
          color: Colors.foreground,
          opacity: disabled ? 0.6 : 1,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        editable={!disabled}
      />
      {hint && <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
    </View>
  );

  if (providerLoading || qnbLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable onPress={() => router.push("/(tabs)/profile" as any)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
            <ArrowLeft size={22} color={Colors.foreground} />
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Payment Settings</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Manage payment provider and QNB POS</Text>
          </View>
        </View>

        {/* Payment Provider Card */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CreditCard size={18} color={Colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Payment Provider</Text>
          </View>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 16 }}>
            Select which payment provider to use for event registrations.
          </Text>

          {/* QNB Option */}
          <Pressable
            onPress={() => setActiveProvider("qnb")}
            style={{
              padding: 14,
              borderWidth: 2,
              borderColor: activeProvider === "qnb" ? Colors.primary : Colors.border,
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>QNB POS</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
              Turkish payment provider with 3D Secure authentication
            </Text>
            {activeProvider === "qnb" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Check size={12} color={Colors.primary} />
                <Text style={{ fontSize: 11, color: Colors.primary }}>Currently Active</Text>
              </View>
            )}
          </Pressable>

          {/* Stripe Option */}
          <Pressable
            onPress={() => setActiveProvider("stripe")}
            style={{
              padding: 14,
              borderWidth: 2,
              borderColor: activeProvider === "stripe" ? Colors.primary : Colors.border,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Stripe</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
              Global payment provider with wide range of payment methods
            </Text>
            {activeProvider === "stripe" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Check size={12} color={Colors.primary} />
                <Text style={{ fontSize: 11, color: Colors.primary }}>Currently Active</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleSaveProvider}
            disabled={providerSaving}
            style={({ pressed }) => ({
              backgroundColor: Colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || providerSaving ? 0.7 : 1,
            })}
          >
            {providerSaving ? (
              <ActivityIndicator size="small" color={Colors.primaryForeground} />
            ) : (
              <Text style={{ color: Colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>Save Changes</Text>
            )}
          </Pressable>
        </View>

        {/* Note */}
        <View style={{ backgroundColor: Colors.muted, borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
            <Text style={{ fontWeight: "600" }}>Note:</Text> Changing the payment provider will affect all future payments. Existing payments will not be affected.
          </Text>
        </View>

        {/* QNB POS Config */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CreditCard size={18} color={Colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>QNB POS Ayarları</Text>
          </View>

          {/* MbrId */}
          <InputField
            label="MbrId (Üye ID)"
            value={formData.mbr_id}
            onChangeText={(v) => setFormData({ ...formData, mbr_id: v })}
            placeholder="5"
            hint='Genellikle "5" olarak kalır'
          />

          {/* Test Mode Toggle */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: Colors.muted + "4D",
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {formData.is_test_mode ? (
                  <TestTube size={14} color="#3b82f6" />
                ) : (
                  <Rocket size={14} color="#22c55e" />
                )}
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>
                  {formData.is_test_mode ? "Test Modu" : "Production Modu"}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                {formData.is_test_mode
                  ? "Test ortamı (gerçek ödeme alınmaz)"
                  : "Canlı ortam (gerçek ödemeler)"}
              </Text>
            </View>
            <Switch
              value={formData.is_test_mode}
              onValueChange={(v) => setFormData({ ...formData, is_test_mode: v })}
              trackColor={{ false: "#ddd", true: "#00471133" }}
              thumbColor={formData.is_test_mode ? Colors.primary : "#999"}
            />
          </View>

          {/* Production Warning */}
          {!formData.is_test_mode && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: Colors.destructive,
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <AlertTriangle size={16} color={Colors.destructive} />
              <Text style={{ fontSize: 12, color: Colors.destructive, flex: 1 }}>
                <Text style={{ fontWeight: "700" }}>Dikkat!</Text> Production modu aktif. Tüm ödemeler gerçek olarak işlenecektir.
              </Text>
            </View>
          )}

          {/* IP Warning */}
          <View style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: Colors.primary,
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
          }}>
            <Info size={16} color={Colors.primary} style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 12, color: Colors.foreground, flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>Önemli:</Text> Production'a geçmeden önce sunucu IP adresinizi sanalpos@qnb.com.tr adresine bildirmeniz gerekmektedir.
            </Text>
          </View>

          {/* Test Credentials */}
          <View style={{
            borderWidth: 2,
            borderColor: formData.is_test_mode ? "#3b82f6" : Colors.border,
            backgroundColor: formData.is_test_mode ? "#3b82f6" + "08" : "transparent",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <TestTube size={14} color={formData.is_test_mode ? "#3b82f6" : Colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: formData.is_test_mode ? "#2563eb" : Colors.mutedForeground }}>
                Test Bilgileri
              </Text>
              {formData.is_test_mode && (
                <View style={{ backgroundColor: "#3b82f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, color: "white", fontWeight: "700" }}>AKTİF</Text>
                </View>
              )}
            </View>

            <InputField label="Merchant ID" value={formData.test_merchant_id} onChangeText={(v) => setFormData({ ...formData, test_merchant_id: v })} disabled={!formData.is_test_mode} />
            <InputField label="Terminal No" value={formData.test_terminal_no} onChangeText={(v) => setFormData({ ...formData, test_terminal_no: v })} disabled={!formData.is_test_mode} />
            <InputField label="API Kullanıcı Adı" value={formData.test_user_code} onChangeText={(v) => setFormData({ ...formData, test_user_code: v })} disabled={!formData.is_test_mode} />
            <InputField label="API Kullanıcı Şifresi" value={formData.test_user_pass} onChangeText={(v) => setFormData({ ...formData, test_user_pass: v })} secureTextEntry disabled={!formData.is_test_mode} />
            <InputField label="3D İşyeri Anahtarı" value={formData.test_merchant_pass} onChangeText={(v) => setFormData({ ...formData, test_merchant_pass: v })} secureTextEntry disabled={!formData.is_test_mode} />

            <View style={{ backgroundColor: Colors.muted, borderRadius: 8, padding: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                <Text style={{ fontWeight: "600" }}>Test Kartı:</Text> 4022780198283155 (Son Kullanma: 01/50, CVC: 000)
              </Text>
            </View>
          </View>

          {/* Production Credentials */}
          <View style={{
            borderWidth: 2,
            borderColor: !formData.is_test_mode ? "#22c55e" : Colors.border,
            backgroundColor: !formData.is_test_mode ? "#22c55e" + "08" : "transparent",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Rocket size={14} color={!formData.is_test_mode ? "#22c55e" : Colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: !formData.is_test_mode ? "#16a34a" : Colors.mutedForeground }}>
                Production Bilgileri
              </Text>
              {!formData.is_test_mode && (
                <View style={{ backgroundColor: "#22c55e", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, color: "white", fontWeight: "700" }}>AKTİF</Text>
                </View>
              )}
            </View>

            <InputField label="Merchant ID" value={formData.prod_merchant_id} onChangeText={(v) => setFormData({ ...formData, prod_merchant_id: v })} placeholder="160600000048686" disabled={formData.is_test_mode} />
            <InputField label="Terminal No" value={formData.prod_terminal_no} onChangeText={(v) => setFormData({ ...formData, prod_terminal_no: v })} placeholder="V3530981" disabled={formData.is_test_mode} />
            <InputField label="API Kullanıcı Adı" value={formData.prod_user_code} onChangeText={(v) => setFormData({ ...formData, prod_user_code: v })} placeholder="leadiser" disabled={formData.is_test_mode} hint="API rolü ile oluşturulmuş kullanıcı" />
            <InputField label="API Kullanıcı Şifresi" value={formData.prod_user_pass} onChangeText={(v) => setFormData({ ...formData, prod_user_pass: v })} secureTextEntry disabled={formData.is_test_mode} hint="Bu şifre kalıcıdır, değiştirilemez" />
            <InputField label="3D İşyeri Anahtarı" value={formData.prod_merchant_pass} onChangeText={(v) => setFormData({ ...formData, prod_merchant_pass: v })} secureTextEntry disabled={formData.is_test_mode} hint="3D Secure hash hesaplamasında kullanılır" />
          </View>

          {/* Save QNB Config */}
          <Pressable
            onPress={handleSaveQnb}
            disabled={qnbSaving}
            style={({ pressed }) => ({
              backgroundColor: Colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pressed || qnbSaving ? 0.7 : 1,
            })}
          >
            {qnbSaving ? (
              <ActivityIndicator size="small" color={Colors.primaryForeground} />
            ) : (
              <>
                <Save size={16} color={Colors.primaryForeground} />
                <Text style={{ color: Colors.primaryForeground, fontWeight: "600", fontSize: 15 }}>Yapılandırmayı Kaydet</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
