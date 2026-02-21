import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Search,
  Save,
  Play,
  Square,
  MoreHorizontal,
  RefreshCcw,
  History,
  CreditCard,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Crown,
  Plus,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { CommitmentDiscounts } from "../../components/admin/CommitmentDiscounts";
import { FamilyMemberships } from "../../components/admin/FamilyMemberships";

interface CommitmentWithProfile {
  id: string;
  user_id: string;
  status: string;
  expiry_date: string;
  auto_renew: boolean;
  amount_paid: number;
  currency: string;
  payment_date: string;
  stripe_subscription_id?: string | null;
  full_name?: string;
  email?: string;
  is_family_primary?: boolean;
  is_family_member?: boolean;
  family_number?: number;
}

interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_provider: string | null;
  created_at: string;
  metadata: any;
  error_message: string | null;
  event_id: string | null;
  event?: { title: string; start_date: string } | null;
}

interface MemberOption { id: string; full_name: string; email: string; }

type StatusFilter = "all" | "active" | "cancelled" | "expired";
type SortField = "full_name" | "expiry_date" | "payment_date" | "amount_paid";
type SortOrder = "asc" | "desc";

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
};

export default function AdminCommitmentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [annualFee, setAnnualFee] = useState(1000);
  const [fee2Members, setFee2Members] = useState(1500);
  const [fee3Members, setFee3Members] = useState(2000);
  const [commitments, setCommitments] = useState<CommitmentWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("expiry_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Action states
  const [actionCommitment, setActionCommitment] = useState<CommitmentWithProfile | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Payment history
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("completed");

  // Add commitment
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [amountPaidUsd, setAmountPaidUsd] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [calculatedTryAmount, setCalculatedTryAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => { fetchData(); fetchAllMembers(); }, []);

  useEffect(() => {
    const calc = async () => {
      if (!paymentDate) return;
      const rate = await fetchExchangeRateForDate(paymentDate);
      setExchangeRate(rate);
      if (rate) {
        const usd = amountPaidUsd ? parseFloat(amountPaidUsd) : annualFee;
        setCalculatedTryAmount(Math.round(usd * rate * 100) / 100);
      }
    };
    calc();
  }, [paymentDate, amountPaidUsd, annualFee]);

  const fetchAllMembers = async () => {
    try {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true });
      setAllMembers(data || []);
    } catch (e) { __DEV__ && console.log("Error fetching members:", e); }
  };

  const fetchExchangeRateForDate = async (date: string): Promise<number | null> => {
    try {
      const { data: rateData } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("from_currency", "USD")
        .eq("to_currency", "TRY")
        .lte("fetched_at", `${date}T23:59:59Z`)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();
      if (rateData) return rateData.rate;
      const { data: currentRate } = await supabase.functions.invoke("get-exchange-rate");
      return currentRate?.rate || null;
    } catch {
      const { data: currentRate } = await supabase.functions.invoke("get-exchange-rate");
      return currentRate?.rate || null;
    }
  };

  const fetchData = async () => {
    try {
      const { data: config } = await supabase.from("commitment_config").select("annual_fee_usd, annual_fee_2_members, annual_fee_3_members").single();
      if (config) { setAnnualFee(config.annual_fee_usd); setFee2Members(config.annual_fee_2_members || 1500); setFee3Members(config.annual_fee_3_members || 2000); }

      const { data: commitmentsData, error } = await supabase.from("commitments").select("*").order("expiry_date", { ascending: true });
      if (error) throw error;

      const { data: fullFamiliesData } = await supabase.from("family_memberships").select("id, family_number, primary_member_id, is_active");
      const { data: familyMembersData } = await supabase.from("family_membership_members").select("family_membership_id, member_id");

      const familyMap = new Map<string, { family_number: number; primary_member_id: string; member_ids: string[] }>();
      if (fullFamiliesData) {
        for (const family of fullFamiliesData) {
          if (!family.is_active) continue;
          const fMembers = (familyMembersData || []).filter((m: any) => m.family_membership_id === family.id);
          const info = { family_number: family.family_number, primary_member_id: family.primary_member_id, member_ids: fMembers.map((m: any) => m.member_id) };
          familyMap.set(family.primary_member_id, info);
          fMembers.forEach((m: any) => familyMap.set(m.member_id, info));
        }
      }

      const result: CommitmentWithProfile[] = [];
      if (commitmentsData && commitmentsData.length > 0) {
        const userIds = commitmentsData.map((c: any) => c.user_id);
        const familyMemberIds: string[] = [];
        const familyMemberCommitmentMap = new Map<string, any>();
        for (const c of commitmentsData) {
          const fd = familyMap.get(c.user_id);
          if (fd && fd.primary_member_id === c.user_id) {
            for (const mid of fd.member_ids) {
              if (!userIds.includes(mid) && !familyMemberIds.includes(mid)) {
                familyMemberIds.push(mid);
                familyMemberCommitmentMap.set(mid, c);
              }
            }
          }
        }
        const allIds = [...userIds, ...familyMemberIds];
        const { data: profilesData } = await supabase.from("profiles").select("id, full_name, email").in("id", allIds);
        const pm = new Map((profilesData || []).map((p: any) => [p.id, p]));

        for (const c of commitmentsData) {
          const fd = familyMap.get(c.user_id);
          result.push({ ...c, full_name: pm.get(c.user_id)?.full_name, email: pm.get(c.user_id)?.email, is_family_primary: fd?.primary_member_id === c.user_id, is_family_member: fd ? fd.primary_member_id !== c.user_id : false, family_number: fd?.family_number });
        }
        for (const mid of familyMemberIds) {
          const fd = familyMap.get(mid);
          const pc = familyMemberCommitmentMap.get(mid);
          if (pc && fd) {
            result.push({ id: `family-${mid}`, user_id: mid, status: pc.status, expiry_date: pc.expiry_date, auto_renew: pc.auto_renew, amount_paid: 0, currency: pc.currency, payment_date: pc.payment_date, stripe_subscription_id: null, full_name: pm.get(mid)?.full_name, email: pm.get(mid)?.email, is_family_primary: false, is_family_member: true, family_number: fd.family_number });
          }
        }
      }
      setCommitments(result);
    } catch (e) {
      __DEV__ && console.log("Error fetching data:", e);
      Alert.alert("Error", "Failed to load commitment data");
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (c: CommitmentWithProfile) => {
    if (c.status === "cancelled") return "cancelled";
    if (new Date(c.expiry_date) < new Date()) return "expired";
    return "active";
  };

  const handleSaveFee = async () => {
    setSaving(true);
    try {
      const { data: configData } = await supabase.from("commitment_config").select("id").single();
      const { error } = await supabase.from("commitment_config").update({ annual_fee_usd: annualFee, annual_fee_2_members: fee2Members, annual_fee_3_members: fee3Members }).eq("id", configData?.id);
      if (error) throw error;
      Alert.alert("Success", "Commitment fees updated successfully");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update fees");
    } finally {
      setSaving(false);
    }
  };

  const handleStopCommitment = async () => {
    if (!actionCommitment) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("commitments").update({ status: "cancelled", auto_renew: false, updated_at: new Date().toISOString() }).eq("id", actionCommitment.id);
      if (error) throw error;
      Alert.alert("Commitment Stopped", `Commitment for ${actionCommitment.full_name} has been stopped.`);
      setShowActionsModal(false);
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to stop commitment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCommitment = async () => {
    if (!actionCommitment) return;
    setActionLoading(true);
    try {
      const newExpiry = new Date();
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      newExpiry.setDate(newExpiry.getDate() - 1);
      const { error } = await supabase.from("commitments").update({ status: "active", auto_renew: true, expiry_date: newExpiry.toISOString(), updated_at: new Date().toISOString() }).eq("id", actionCommitment.id);
      if (error) throw error;
      Alert.alert("Commitment Started", `Commitment for ${actionCommitment.full_name} has been reactivated.`);
      setShowActionsModal(false);
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to start commitment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!actionCommitment) return;
    Alert.alert("Process Refund?", `Refund ${actionCommitment.currency} ${actionCommitment.amount_paid.toLocaleString()} for ${actionCommitment.full_name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Process Refund", style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            const { data: payments } = await supabase.from("payments").select("*").eq("user_id", actionCommitment.user_id).eq("status", "completed").order("created_at", { ascending: false });
            const commitmentPayment = payments?.find((p: any) => (p.metadata as any)?.type === "commitment");
            if (!commitmentPayment) throw new Error("No completed payment found");
            const provider = commitmentPayment.payment_provider;
            let data, error;
            if (provider === "qnb") {
              const r = await supabase.functions.invoke("process-qnb-refund", { body: { paymentId: commitmentPayment.id, refundPercentage: 100 } });
              data = r.data; error = r.error;
            } else if (provider === "sipay") {
              const r = await supabase.functions.invoke("process-sipay-refund", { body: { paymentId: commitmentPayment.id, refundPercentage: 100 } });
              data = r.data; error = r.error;
            } else if (provider === "stripe" || actionCommitment.stripe_subscription_id) {
              const r = await supabase.functions.invoke("process-commitment-refund", { body: { commitmentId: actionCommitment.id, userId: actionCommitment.user_id } });
              data = r.data; error = r.error;
            } else {
              throw new Error(`Unknown payment provider: ${provider}`);
            }
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Refund failed");
            await supabase.from("commitments").update({ status: "refunded", auto_renew: false, updated_at: new Date().toISOString() }).eq("id", actionCommitment.id);
            Alert.alert("Refund Processed", `Refund processed via ${provider?.toUpperCase() || "Stripe"}.`);
            setShowActionsModal(false);
            fetchData();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to process refund");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const fetchPaymentHistory = async (userId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.from("payments").select("*, events:event_id(title, start_date)").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      const payments = (data || []).map((p: any) => ({ ...p, event: p.events }));
      setPaymentHistory(payments);
      setHistoryStatusFilter(payments.some((p: any) => p.status === "completed") ? "completed" : "all");
    } catch (e) {
      Alert.alert("Error", "Failed to load payment history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefundPayment = (payment: PaymentHistory) => {
    if (!actionCommitment) return;
    Alert.alert("Process Refund?", `Refund ${payment.currency} ${payment.amount.toLocaleString()}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Refund", style: "destructive",
        onPress: async () => {
          setRefundingPaymentId(payment.id);
          try {
            const provider = payment.payment_provider;
            let data, error;
            if (provider === "qnb") { const r = await supabase.functions.invoke("process-qnb-refund", { body: { paymentId: payment.id, refundPercentage: 100 } }); data = r.data; error = r.error; }
            else if (provider === "sipay") { const r = await supabase.functions.invoke("process-sipay-refund", { body: { paymentId: payment.id, refundPercentage: 100 } }); data = r.data; error = r.error; }
            else if (provider === "stripe") { const r = await supabase.functions.invoke("process-stripe-refund", { body: { paymentId: payment.id, refundPercentage: 100 } }); data = r.data; error = r.error; }
            else throw new Error(`Unknown provider: ${provider}`);
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Refund failed");
            const meta = payment.metadata as any;
            if (meta?.type === "commitment") {
              await supabase.from("commitments").update({ status: "refunded", auto_renew: false, updated_at: new Date().toISOString() }).eq("user_id", actionCommitment.user_id);
            }
            Alert.alert("Refund Processed", `Refund processed via ${provider?.toUpperCase()}.`);
            fetchPaymentHistory(actionCommitment.user_id);
            fetchData();
          } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to process refund");
          } finally {
            setRefundingPaymentId(null);
          }
        },
      },
    ]);
  };

  const handleAddCommitment = async () => {
    if (!selectedMemberId) { Alert.alert("Error", "Please select a member"); return; }
    setAddLoading(true);
    try {
      const startDateObj = new Date(startDate);
      const expiryDate = new Date(startDateObj);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      expiryDate.setDate(expiryDate.getDate() - 1);
      const usdAmount = amountPaidUsd ? parseFloat(amountPaidUsd) : annualFee;
      const tryAmount = calculatedTryAmount || (exchangeRate ? usdAmount * exchangeRate : usdAmount);

      const { data: existing } = await supabase.from("commitments").select("id").eq("user_id", selectedMemberId).single();
      if (existing) {
        const { error } = await supabase.from("commitments").update({ status: "active", expiry_date: expiryDate.toISOString(), auto_renew: false, amount_paid: tryAmount, currency: "TRY", payment_date: paymentDate, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commitments").insert({ user_id: selectedMemberId, status: "active", expiry_date: expiryDate.toISOString(), auto_renew: false, amount_paid: tryAmount, currency: "TRY", payment_date: paymentDate });
        if (error) throw error;
      }
      await supabase.from("payments").insert({ user_id: selectedMemberId, amount: tryAmount, currency: "TRY", status: "completed", payment_provider: "bank_transfer", metadata: { type: "commitment", payment_date: paymentDate, expiry_date: expiryDate.toISOString(), base_amount_usd: usdAmount, exchange_rate: exchangeRate, total_amount_try: tryAmount } });

      Alert.alert("Commitment Added", "The commitment has been added successfully.");
      setShowAddModal(false);
      setSelectedMemberId("");
      setAmountPaidUsd("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setStartDate(new Date().toISOString().split("T")[0]);
      setCalculatedTryAmount(null);
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add commitment");
    } finally {
      setAddLoading(false);
    }
  };

  const filtered = commitments
    .filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.full_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && getStatus(c) !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "full_name": cmp = (a.full_name || "").localeCompare(b.full_name || ""); break;
        case "expiry_date": cmp = new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(); break;
        case "payment_date": cmp = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(); break;
        case "amount_paid": cmp = a.amount_paid - b.amount_paid; break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

  const filteredAddMembers = allMembers.filter(
    (m) => m.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const EF = ({ label, value, onChangeText, placeholder, keyboardType, hint }: any) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 3 }}>{label}</Text>
      <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground }} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.mutedForeground} keyboardType={keyboardType} />
      {hint && <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
    </View>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const c: Record<string, { bg: string; text: string }> = { active: { bg: "#dcfce7", text: "#16a34a" }, cancelled: { bg: "#fee2e2", text: "#dc2626" }, expired: { bg: "#f3f4f6", text: "#6b7280" } };
    const s = c[status] || c.expired;
    return <View style={{ backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 10, fontWeight: "500", color: s.text, textTransform: "capitalize" }}>{status}</Text></View>;
  };

  if (loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}><ArrowLeft size={22} color={Colors.foreground} /></Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: Colors.foreground }}>Commitments</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>Manage annual commitment settings</Text>
          </View>
        </View>

        {/* Fee Config */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <DollarSign size={18} color={Colors.primary} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Annual Commitment Price</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 3 }}>Individual (USD)</Text>
              <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 13, color: Colors.foreground }} value={annualFee.toString()} onChangeText={(t) => setAnnualFee(Number(t) || 0)} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 3 }}>2 Family (USD)</Text>
              <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 13, color: Colors.foreground }} value={fee2Members.toString()} onChangeText={(t) => setFee2Members(Number(t) || 0)} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 3 }}>3 Family (USD)</Text>
              <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 8, fontSize: 13, color: Colors.foreground }} value={fee3Members.toString()} onChangeText={(t) => setFee3Members(Number(t) || 0)} keyboardType="numeric" />
            </View>
          </View>
          <Pressable onPress={handleSaveFee} disabled={saving} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, opacity: pressed || saving ? 0.7 : 1 })}>
            {saving ? <ActivityIndicator size="small" color="white" /> : <><Save size={14} color="white" /><Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>Save Fees</Text></>}
          </Pressable>
          <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 6 }}>Family pricing is only visible to members assigned to family memberships.</Text>
        </View>

        {/* Committed Members */}
        <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Users size={18} color={Colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Committed Members</Text>
              <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{commitments.length}</Text>
              </View>
            </View>
            <Pressable onPress={() => setShowAddModal(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, opacity: pressed ? 0.85 : 1 })}>
              <Plus size={12} color="white" /><Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>Add New</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, marginBottom: 10 }}>
            <Search size={14} color={Colors.mutedForeground} />
            <TextInput style={{ flex: 1, paddingVertical: 8, paddingLeft: 8, fontSize: 13, color: Colors.foreground }} placeholder="Search by name or email..." placeholderTextColor={Colors.mutedForeground} value={searchQuery} onChangeText={setSearchQuery} />
          </View>

          {/* Status Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["all", "active", "cancelled", "expired"] as StatusFilter[]).map((s) => (
                <Pressable key={s} onPress={() => setStatusFilter(s)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: statusFilter === s ? Colors.primary : Colors.border, backgroundColor: statusFilter === s ? Colors.primary + "1A" : "white" }}>
                  <Text style={{ fontSize: 11, color: statusFilter === s ? Colors.primary : Colors.mutedForeground, textTransform: "capitalize" }}>{s === "all" ? "All Status" : s}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* List */}
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Users size={32} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{searchQuery || statusFilter !== "all" ? "No members matching filters" : "No committed members yet"}</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {filtered.map((c) => {
                const status = getStatus(c);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { setActionCommitment(c); setShowActionsModal(true); }}
                    style={({ pressed }) => ({ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, opacity: pressed ? 0.8 : 1 })}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {c.is_family_primary && <Crown size={14} color={Colors.primary} />}
                        <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>{c.full_name || "Unknown"}</Text>
                      </View>
                      <StatusBadge status={status} />
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(c.is_family_primary || c.is_family_member) && (
                        <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 9, color: Colors.mutedForeground }}>Family #{c.family_number}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 11, color: status === "expired" ? Colors.destructive : Colors.mutedForeground }}>Exp: {fmtDate(c.expiry_date)}</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{c.currency} {c.amount_paid.toLocaleString()}</Text>
                      <View style={{ backgroundColor: c.auto_renew ? "#dcfce7" : "#f3f4f6", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, color: c.auto_renew ? "#16a34a" : "#6b7280" }}>Auto: {c.auto_renew ? "Yes" : "No"}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Discounts Section */}
        <View style={{ marginTop: 16 }}>
          <CommitmentDiscounts />
        </View>

        {/* Family Memberships Section */}
        <View style={{ marginTop: 16 }}>
          <FamilyMemberships />
        </View>
      </ScrollView>

      {/* Actions Modal */}
      <Modal visible={showActionsModal} transparent animationType="slide" onRequestClose={() => setShowActionsModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>{actionCommitment?.full_name}</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 16 }}>{actionCommitment?.email}</Text>
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => { setShowActionsModal(false); if (actionCommitment) { fetchPaymentHistory(actionCommitment.user_id); setShowHistoryModal(true); } }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, opacity: pressed ? 0.7 : 1 })}>
                <History size={18} color={Colors.foreground} /><Text style={{ fontSize: 14, color: Colors.foreground }}>View Payment History</Text>
              </Pressable>
              {getStatus(actionCommitment!) === "active" ? (
                <Pressable onPress={() => { Alert.alert("Stop Commitment?", `Cancel commitment for ${actionCommitment?.full_name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Stop", style: "destructive", onPress: handleStopCommitment }]); }} disabled={actionLoading} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1, borderColor: Colors.destructive, borderRadius: 12, opacity: pressed || actionLoading ? 0.7 : 1 })}>
                  <Square size={18} color={Colors.destructive} /><Text style={{ fontSize: 14, color: Colors.destructive }}>Stop Commitment</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => { Alert.alert("Start Commitment?", `Reactivate commitment for ${actionCommitment?.full_name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Start", onPress: handleStartCommitment }]); }} disabled={actionLoading} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, opacity: pressed || actionLoading ? 0.7 : 1 })}>
                  <Play size={18} color={Colors.primary} /><Text style={{ fontSize: 14, color: Colors.primary }}>Start Commitment</Text>
                </Pressable>
              )}
              <Pressable onPress={handleRefund} disabled={actionLoading} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: Colors.destructive, borderRadius: 12, opacity: pressed || actionLoading ? 0.7 : 1 })}>
                <RefreshCcw size={18} color="white" /><Text style={{ fontSize: 14, color: "white", fontWeight: "600" }}>Process Refund</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setShowActionsModal(false)} style={{ marginTop: 12, alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Payment History Modal */}
      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <History size={18} color={Colors.foreground} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Payment History</Text>
            </View>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 12 }}>{actionCommitment?.full_name} · {actionCommitment?.email}</Text>

            {/* Status filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {["all", "completed", "failed", "pending", "refunded"].map((s) => (
                  <Pressable key={s} onPress={() => setHistoryStatusFilter(s)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: historyStatusFilter === s ? Colors.primary : Colors.border, backgroundColor: historyStatusFilter === s ? Colors.primary + "1A" : "white" }}>
                    <Text style={{ fontSize: 11, color: historyStatusFilter === s ? Colors.primary : Colors.mutedForeground, textTransform: "capitalize" }}>{s} ({s === "all" ? paymentHistory.length : paymentHistory.filter((p) => p.status === s).length})</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {historyLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ paddingVertical: 32 }} />
            ) : paymentHistory.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <CreditCard size={32} color={Colors.mutedForeground} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>No payment history found</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ gap: 10 }}>
                  {paymentHistory.filter((p) => historyStatusFilter === "all" || p.status === historyStatusFilter).map((payment) => {
                    const meta = (payment.metadata as any) || {};
                    const isCommitment = meta?.type === "commitment";
                    const canRefund = payment.status === "completed";
                    const statusColor: Record<string, string> = { completed: "#16a34a", failed: "#dc2626", pending: "#d97706", refunded: "#6b7280" };
                    return (
                      <View key={payment.id} style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <View style={{ backgroundColor: (statusColor[payment.status] || "#6b7280") + "1A", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "500", color: statusColor[payment.status] || "#6b7280", textTransform: "capitalize" }}>{payment.status}</Text>
                          </View>
                          <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{new Date(payment.created_at).toLocaleString()}</Text>
                        </View>
                        <View style={{ backgroundColor: Colors.muted, borderRadius: 8, padding: 8, marginBottom: 6 }}>
                          {isCommitment ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Users size={14} color={Colors.primary} />
                              <Text style={{ fontSize: 12, fontWeight: "500" }}>Annual Commitment</Text>
                            </View>
                          ) : payment.event ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Calendar size={14} color={Colors.primary} />
                              <Text style={{ fontSize: 12, fontWeight: "500" }}>{payment.event.title}</Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <CreditCard size={14} color={Colors.mutedForeground} />
                              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Payment</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{payment.currency} {payment.amount.toLocaleString()}</Text>
                          {payment.payment_provider && (
                            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, color: Colors.mutedForeground }}>{payment.payment_provider === "bank_transfer" ? "Bank Transfer" : payment.payment_provider.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        {(meta.base_amount_usd || meta.exchange_rate) && (
                          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 6 }}>
                            {meta.base_amount_usd && <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Base: ${meta.base_amount_usd} USD</Text>}
                            {meta.exchange_rate && <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Rate: {meta.exchange_rate}</Text>}
                            {meta.total_amount_try && <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.foreground }}>Charged: ₺{meta.total_amount_try} TRY</Text>}
                          </View>
                        )}
                        {payment.error_message && <Text style={{ fontSize: 10, color: Colors.destructive, marginTop: 4 }}>Error: {payment.error_message}</Text>}
                        {canRefund && (
                          <Pressable onPress={() => handleRefundPayment(payment)} disabled={refundingPaymentId === payment.id} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.destructive, borderRadius: 10, paddingVertical: 8, marginTop: 8, opacity: pressed || refundingPaymentId === payment.id ? 0.7 : 1 })}>
                            {refundingPaymentId === payment.id ? <ActivityIndicator size="small" color="white" /> : <><RefreshCcw size={12} color="white" /><Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Process Refund</Text></>}
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            <Pressable onPress={() => setShowHistoryModal(false)} style={{ marginTop: 12, alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Commitment Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Plus size={18} color={Colors.foreground} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Add New Commitment</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Member Selection */}
              <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 4 }}>Select Member *</Text>
              <TextInput style={{ backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 9, fontSize: 13, color: Colors.foreground, marginBottom: 6 }} placeholder="Search members..." placeholderTextColor={Colors.mutedForeground} value={memberSearchQuery} onChangeText={setMemberSearchQuery} />
              {selectedMemberId ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary + "1A", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.primary }}>{allMembers.find((m) => m.id === selectedMemberId)?.full_name}</Text>
                  <Pressable onPress={() => setSelectedMemberId("")}><XCircle size={16} color={Colors.primary} /></Pressable>
                </View>
              ) : (
                <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, maxHeight: 150, marginBottom: 12 }}>
                  <FlatList
                    data={filteredAddMembers.slice(0, 50)}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => { setSelectedMemberId(item.id); setMemberSearchQuery(""); }} style={({ pressed }) => ({ padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "33", opacity: pressed ? 0.7 : 1 })}>
                        <Text style={{ fontSize: 12, fontWeight: "500", color: Colors.foreground }}>{item.full_name}</Text>
                        <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{item.email}</Text>
                      </Pressable>
                    )}
                  />
                </View>
              )}

              <EF label="Amount Paid (USD)" value={amountPaidUsd} onChangeText={setAmountPaidUsd} placeholder={`Leave empty for default: $${annualFee}`} keyboardType="decimal-pad" hint={`Leave empty to use current price ($${annualFee})`} />
              <EF label="Payment Date *" value={paymentDate} onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" hint="Exchange rate from this date will be used" />
              <EF label="Commitment Start Date *" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" hint="Commitment expires 1 year from this date" />

              {calculatedTryAmount !== null && exchangeRate !== null && (
                <View style={{ backgroundColor: Colors.muted, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Amount (USD):</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600" }}>${amountPaidUsd || annualFee}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Exchange Rate:</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600" }}>1 USD = {exchangeRate.toFixed(2)} TRY</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700" }}>Amount (TRY):</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.primary }}>₺{calculatedTryAmount.toLocaleString()}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <Pressable onPress={handleAddCommitment} disabled={addLoading || !selectedMemberId} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, opacity: pressed || addLoading || !selectedMemberId ? 0.7 : 1, marginTop: 8, marginBottom: 8 })}>
              {addLoading ? <ActivityIndicator size="small" color="white" /> : <><Plus size={14} color="white" /><Text style={{ color: "white", fontWeight: "600" }}>Add Commitment</Text></>}
            </Pressable>
            <Pressable onPress={() => setShowAddModal(false)} style={{ alignItems: "center", paddingVertical: 10 }}>
              <Text style={{ color: Colors.mutedForeground }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
