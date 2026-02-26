import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Award, Calendar, RefreshCw, XCircle, Users } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useViewAs } from "../../stores/ViewAsContext";
import { Colors } from "../../constants/Colors";
import { CommitmentCheckoutModal } from "../payment/CommitmentCheckoutModal";

interface Commitment {
  id: string;
  status: string;
  expiry_date: string;
  auto_renew: boolean;
  amount_paid: number;
  currency: string;
  payment_date: string;
}

interface FamilyMembership {
  id: string;
  family_number: number;
  member_count: number;
  is_active: boolean;
  primary_member_id: string;
  primary_member_name?: string;
  members: Array<{ id: string; full_name: string }>;
  isPrimaryMember: boolean;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export const CommitmentSection = () => {
  const { getEffectiveUserId } = useViewAs();
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [familyMembership, setFamilyMembership] = useState<FamilyMembership | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutIsRenewal, setCheckoutIsRenewal] = useState(false);

  const fetchCommitment = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);
      const { data, error } = await supabase
        .from("commitments")
        .select("*")
        .eq("user_id", effectiveId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (data) {
        const expiryDate = new Date(data.expiry_date);
        if (expiryDate < new Date()) data.status = "expired";
        setCommitment(data);
      }
    } catch (e) {
      __DEV__ && console.log("Error fetching commitment:", e);
    } finally {
      setLoading(false);
    }
  }, [getEffectiveUserId]);

  const fetchFamilyMembership = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const effectiveId = getEffectiveUserId(user.id);

      const { data: primaryFamily, error: primaryError } = await supabase
        .from("family_memberships")
        .select("id, family_number, member_count, is_active, primary_member_id")
        .eq("primary_member_id", effectiveId)
        .eq("is_active", true)
        .single();

      if (primaryFamily && !primaryError) {
        const { data: members } = await supabase
          .from("family_membership_members")
          .select("member_id, profiles:member_id (id, full_name)")
          .eq("family_membership_id", primaryFamily.id);
        const familyMembers = (members || []).map((m: any) => ({
          id: m.profiles?.id,
          full_name: m.profiles?.full_name || "Unknown",
        }));
        setFamilyMembership({ ...primaryFamily, members: familyMembers, isPrimaryMember: true });
        return;
      }

      const { data: memberRecord, error: memberError } = await supabase
        .from("family_membership_members")
        .select("family_membership_id")
        .eq("member_id", effectiveId)
        .single();

      if (memberRecord && !memberError) {
        const { data: familyData } = await supabase
          .from("family_memberships")
          .select("id, family_number, member_count, is_active, primary_member_id")
          .eq("id", memberRecord.family_membership_id)
          .eq("is_active", true)
          .single();

        if (familyData) {
          const { data: primaryProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", familyData.primary_member_id)
            .single();

          const { data: primaryCommitment } = await supabase
            .from("commitments")
            .select("*")
            .eq("user_id", familyData.primary_member_id)
            .single();

          if (primaryCommitment) {
            if (new Date(primaryCommitment.expiry_date) < new Date()) primaryCommitment.status = "expired";
            setCommitment(primaryCommitment);
          }

          setFamilyMembership({
            id: familyData.id,
            family_number: familyData.family_number,
            member_count: familyData.member_count,
            is_active: familyData.is_active,
            primary_member_id: familyData.primary_member_id,
            primary_member_name: primaryProfile?.full_name || "your primary member",
            members: [],
            isPrimaryMember: false,
          });
        }
      }
    } catch (e) {
      __DEV__ && console.log("Error fetching family membership:", e);
    }
  }, [getEffectiveUserId]);

  useEffect(() => {
    fetchCommitment();
    fetchFamilyMembership();
  }, [fetchCommitment, fetchFamilyMembership]);

  const handleCancelRenewal = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("cancel-commitment-renewal");
      if (error) throw error;
      Alert.alert("Renewal Cancelled", "Automatic renewal has been cancelled. Your commitment remains active until the expiry date.");
      setShowCancelConfirm(false);
      fetchCommitment();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to cancel renewal");
    } finally {
      setCancelling(false);
    }
  };

  const handleGetCommitted = () => {
    setCheckoutIsRenewal(false);
    setShowCheckout(true);
  };

  const handleRenewEarly = () => {
    setCheckoutIsRenewal(true);
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    fetchCommitment();
    fetchFamilyMembership();
  };

  if (loading) {
    return (
      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", minHeight: 80 }}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  const isActive = commitment && commitment.status === "active" && new Date(commitment.expiry_date) > new Date();
  const isNonPrimaryFamilyMember = familyMembership && !familyMembership.isPrimaryMember;

  return (
    <>
      <View style={{ backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Award size={20} color={Colors.primary} />
          <Text style={{ fontSize: 18, fontWeight: "600", color: Colors.primary }}>Commitment</Text>
        </View>

        {isNonPrimaryFamilyMember ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(27, 59, 47, 0.05)', borderWidth: 1, borderColor: 'rgba(27, 59, 47, 0.2)', borderRadius: 12, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Users size={16} color={Colors.primary} />
                <View style={{ backgroundColor: 'rgba(27, 59, 47, 0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "600" }}>Family Member</Text>
                </View>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground }}>
                You are a family member of an active membership.
              </Text>
            </View>
            {commitment && new Date(commitment.expiry_date) > new Date() && (
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Calendar size={16} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Commitment Expiry:</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, paddingLeft: 24 }}>
                  {formatDate(commitment.expiry_date)}
                </Text>
              </View>
            )}
          </View>
        ) : isActive ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(27, 59, 47, 0.05)', borderWidth: 1, borderColor: 'rgba(27, 59, 47, 0.2)', borderRadius: 12, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <View style={{ backgroundColor: 'rgba(27, 59, 47, 0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "600" }}>Active</Text>
                </View>
                {commitment!.auto_renew && (
                  <View style={{ borderWidth: 1, borderColor: Colors.primary + "4D", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: Colors.primary }}>Auto-Renew</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 14, color: Colors.foreground, marginBottom: 4 }}>Your annual commitment is active.</Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Renewal is automatic unless cancelled.</Text>
            </View>

            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Calendar size={16} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Commitment Expiry:</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, paddingLeft: 24 }}>
                {formatDate(commitment!.expiry_date)}
              </Text>
            </View>

            {commitment!.auto_renew && (
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Calendar size={16} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Next Payment Will Be Taken On:</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, paddingLeft: 24 }}>
                  {formatDate(new Date(new Date(commitment!.expiry_date).getTime() + 86400000).toISOString())}
                </Text>
              </View>
            )}

            <View style={{ gap: 8, paddingTop: 8 }}>
              <Pressable
                onPress={handleRenewEarly}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <RefreshCw size={16} color="white" />
                <Text style={{ color: "white", fontWeight: "600" }}>Renew Early</Text>
              </Pressable>

              {commitment!.auto_renew && (
                <>
                  <Pressable
                    onPress={() => setShowCancelConfirm(true)}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <XCircle size={16} color={Colors.foreground} />
                    <Text style={{ color: Colors.foreground, fontWeight: "600" }}>Cancel Automatic Renewal</Text>
                  </Pressable>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>
                    Cancel only stops automatic renewal; your plan continues until the expiry date.
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border + "80", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: Colors.foreground, marginBottom: 4 }}>No Active Payment Plan</Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>You are not on a committed terms at the moment.</Text>
            </View>
            <Pressable
              onPress={handleGetCommitted}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                backgroundColor: Colors.copper, borderRadius: 12, paddingVertical: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Award size={16} color={Colors.secondary} />
              <Text style={{ color: Colors.secondary, fontWeight: "600" }}>Become a Member</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Commitment Checkout Modal */}
      <CommitmentCheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        isRenewal={checkoutIsRenewal}
        currentExpiryDate={commitment?.expiry_date}
        onSuccess={handleCheckoutSuccess}
        familyMembership={familyMembership}
      />

      {/* Cancel Renewal Confirmation Modal */}
      <Modal visible={showCancelConfirm} transparent animationType="fade" onRequestClose={() => setShowCancelConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 24, width: "100%" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 8 }}>Cancel Automatic Renewal?</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 20, marginBottom: 24 }}>
              This will cancel your automatic renewal. Your commitment will remain active until{" "}
              {commitment ? formatDate(commitment.expiry_date) : ""}. After this date, your access will end.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setShowCancelConfirm(false)}
                style={({ pressed }) => ({
                  flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontWeight: "600", color: Colors.foreground }}>Keep Auto-Renewal</Text>
              </Pressable>
              <Pressable
                onPress={handleCancelRenewal}
                disabled={cancelling}
                style={({ pressed }) => ({
                  flex: 1, backgroundColor: Colors.secondary, borderRadius: 12,
                  paddingVertical: 12, alignItems: "center", opacity: pressed || cancelling ? 0.7 : 1,
                })}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={{ fontWeight: "600", color: "white" }}>Cancel Renewal</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};
