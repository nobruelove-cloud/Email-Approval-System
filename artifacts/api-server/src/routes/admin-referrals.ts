import { Router, type IRouter, type Request, type Response } from "express";
import { type DecodedIdToken } from "firebase-admin/auth";
import { type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { adminAuth, adminDb, FieldValue } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

export interface ReferralTierConfig {
  minAcc: number;
  reward: number;
}

export const DEFAULT_REFERRAL_TIERS: ReferralTierConfig[] = [
  { minAcc: 5, reward: 5000 },
  { minAcc: 10, reward: 15000 },
  { minAcc: 20, reward: 35000 },
  { minAcc: 50, reward: 100000 },
];

function formatMoney(amount: number): string {
  return `Rp ${Math.max(0, amount).toLocaleString("id-ID")}`;
}

function shortId(id: string | null | undefined): string {
  if (!id) return "";
  const str = String(id);
  return str.length > 8 ? str.slice(0, 8) : str;
}

function sanitizePayload<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as T;
}

const router: IRouter = Router();

router.post("/admin/referrals/:referralId/approve", async (req: Request, res: Response): Promise<void> => {
  const referralId = req.params.referralId ? String(req.params.referralId).trim() : "";
  const targetMinAcc = req.body?.targetMinAcc !== undefined ? Number(req.body.targetMinAcc) : undefined;

  console.log("[ADMIN REFERRAL ID TRACE]", {
    serverReceivedReferralId: referralId,
    referralIdType: typeof referralId,
    referralIdLength: referralId.length,
    requestUrlPath: req.originalUrl || req.url,
  });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn({ referralId }, "[ADMIN REFERRAL APPROVAL] Missing or malformed Authorization header");
    res.status(401).json({ error: "Sesi tidak ditemukan. Silakan masuk sebagai admin." });
    return;
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    res.status(401).json({ error: "Token otentikasi tidak valid." });
    return;
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "[ADMIN REFERRAL APPROVAL] Invalid Firebase ID token");
    res.status(401).json({ error: "Otentikasi gagal: Token tidak valid atau kedaluwarsa." });
    return;
  }

  const verifiedAuthUid = decodedToken.uid;

  // Verify Admin Firestore Profile
  try {
    const adminUserSnap = await adminDb.doc(`users/${verifiedAuthUid}`).get();
    if (!adminUserSnap.exists) {
      logger.warn({ verifiedAuthUid }, "[ADMIN REFERRAL APPROVAL] Admin user profile document does not exist");
      res.status(403).json({ error: "Akses ditolak: Profil admin tidak ditemukan." });
      return;
    }

    const adminProfile = adminUserSnap.data();
    const roleStr = typeof adminProfile?.role === "string" ? adminProfile.role.trim().toLowerCase() : "";
    const statusStr = typeof adminProfile?.status === "string" ? adminProfile.status.trim().toLowerCase() : "";

    if (roleStr !== "admin" || (statusStr !== "active" && statusStr !== "approved")) {
      logger.warn(
        { verifiedAuthUid, role: adminProfile?.role, status: adminProfile?.status },
        "[ADMIN REFERRAL APPROVAL] Access denied: user is not an active admin"
      );
      res.status(403).json({ error: "Akses ditolak: Hanya akun admin aktif yang berhak menyetujui referral." });
      return;
    }
  } catch (err) {
    logger.error({ verifiedAuthUid, err }, "[ADMIN REFERRAL APPROVAL] Error checking admin profile");
    res.status(500).json({ error: "Terjadi kesalahan server saat memverifikasi hak akses admin." });
    return;
  }

  // Execute Firestore Transaction with strict read-before-write sequence
  let currentPhase = "INITIALIZING";
  let currentOperation = "START";
  let currentPath = `referrals/${referralId}`;

  try {
    const result = await adminDb.runTransaction(async (tx: Transaction) => {
      // --- ALL READS FIRST ---
      currentPhase = "READ_PHASE";

      // READ 1: referrals/{referralId}
      currentOperation = `READ 1 referrals/${referralId}`;
      currentPath = `referrals/${referralId}`;
      const referralRef = adminDb.doc(`referrals/${referralId}`);
      let referralSnap = await tx.get(referralRef);

      console.log("[ADMIN REFERRAL LOOKUP]", {
        receivedReferralId: referralId,
        directPath: `referrals/${referralId}`,
        directExists: referralSnap.exists,
        directSnapshotId: referralSnap.exists ? referralSnap.id : null,
        directSafeFieldNames: referralSnap.exists ? Object.keys(referralSnap.data() || {}) : [],
      });

      logger.info(
        {
          referralId,
          searchedPath: `referrals/${referralId}`,
          exists: referralSnap.exists,
          actualDocId: referralSnap.exists ? referralSnap.id : null,
          safeFieldNames: referralSnap.exists ? Object.keys(referralSnap.data() || {}) : [],
        },
        "[ADMIN REFERRAL APPROVAL] Referral document lookup"
      );

      // Fallback lookup during READ_PHASE if direct document ID lookup yields nothing
      if (!referralSnap.exists) {
        currentOperation = `READ 1 (fallback by referredWorkerId) referrals/${referralId}`;
        const queryByWorker = adminDb.collection("referrals").where("referredWorkerId", "==", referralId);
        const workerSnap = await tx.get(queryByWorker as any);
        if (workerSnap && !workerSnap.empty && Array.isArray(workerSnap.docs) && workerSnap.docs.length > 0) {
          referralSnap = workerSnap.docs[0] as any;
          const safeFieldNames = Object.keys(referralSnap.data() || {});
          console.log("[ADMIN REFERRAL LOOKUP - FALLBACK MATCH]", {
            fallbackQueryField: "referredWorkerId",
            fallbackMatchedDocumentId: referralSnap.id,
            fallbackMatchedSafeFieldNames: safeFieldNames,
          });
          logger.info(
            { referralId, fallbackQueryField: "referredWorkerId", matchedDocId: referralSnap.id, safeFieldNames },
            "[ADMIN REFERRAL APPROVAL] Fallback match found by referredWorkerId"
          );
        } else {
          currentOperation = `READ 1 (fallback by id field) referrals/${referralId}`;
          const queryById = adminDb.collection("referrals").where("id", "==", referralId);
          const idSnap = await tx.get(queryById as any);
          if (idSnap && !idSnap.empty && Array.isArray(idSnap.docs) && idSnap.docs.length > 0) {
            referralSnap = idSnap.docs[0] as any;
            const safeFieldNames = Object.keys(referralSnap.data() || {});
            console.log("[ADMIN REFERRAL LOOKUP - FALLBACK MATCH]", {
              fallbackQueryField: "id",
              fallbackMatchedDocumentId: referralSnap.id,
              fallbackMatchedSafeFieldNames: safeFieldNames,
            });
            logger.info(
              { referralId, fallbackQueryField: "id", matchedDocId: referralSnap.id, safeFieldNames },
              "[ADMIN REFERRAL APPROVAL] Fallback match found by id field"
            );
          }
        }
      }

      if (!referralSnap.exists) {
        logger.warn({ referralId, searchedPath: `referrals/${referralId}` }, "[ADMIN REFERRAL APPROVAL] Referral document not found");
        throw { code: "NOT_FOUND", status: 404, message: "Data referral tidak ditemukan." };
      }

      const actualDocId = referralSnap.id;
      const referralData = referralSnap.data() || {};
      const status = referralData.status ?? "PENDING";
      if (status === "REJECTED") {
        throw { code: "INVALID_STATUS", status: 400, message: "Referral ini sudah ditolak." };
      }

      const effectiveReferrerId =
        (referralData.referrerId && String(referralData.referrerId).trim()) ||
        referralData.id ||
        actualDocId;

      const effectiveReferredWorkerId =
        (referralData.referredWorkerId && String(referralData.referredWorkerId).trim()) ||
        referralData.id ||
        actualDocId;

      const effectiveReferredWorkerName =
        referralData.referredWorkerName ||
        shortId(effectiveReferredWorkerId);

      // READ 2: settings/rules
      currentOperation = "READ 2 settings/rules";
      currentPath = "settings/rules";
      const rulesRef = adminDb.doc("settings/rules");
      const rulesSnap = await tx.get(rulesRef);
      const rulesData = rulesSnap.exists ? rulesSnap.data() : {};
      const referralTiers = (rulesData?.referralTiers ?? DEFAULT_REFERRAL_TIERS) as ReferralTierConfig[];

      const currentAcc = Number(referralData.currentAccCount ?? 0);
      const claimedTiers: Record<string, boolean> = referralData.claimedTiers || {};

      let tiersToClaim: ReferralTierConfig[] = [];
      if (typeof targetMinAcc === "number" && !isNaN(targetMinAcc)) {
        const found = referralTiers.find((t) => Number(t.minAcc) === targetMinAcc);
        if (!found) {
          throw { code: "TIER_NOT_FOUND", status: 400, message: `Tier referral ${targetMinAcc} ACC tidak ditemukan.` };
        }
        if (currentAcc < found.minAcc) {
          throw { code: "TARGET_NOT_MET", status: 400, message: `Target ACC belum tercapai (${currentAcc}/${found.minAcc}).` };
        }
        if (claimedTiers[String(found.minAcc)]) {
          throw { code: "ALREADY_CLAIMED", status: 409, message: `Tier ${found.minAcc} ACC sudah pernah diklaim/disetujui.` };
        }
        tiersToClaim = [found];
      } else {
        tiersToClaim = referralTiers.filter(
          (t) => currentAcc >= t.minAcc && !claimedTiers[String(t.minAcc)]
        );
        if (tiersToClaim.length === 0) {
          if (status === "PAID" || status === "REWARDED") {
            throw { code: "ALREADY_PAID", status: 409, message: "Referral ini sudah pernah disetujui / dibayar seluruhnya." };
          }
          throw { code: "NO_ELIGIBLE_TIERS", status: 400, message: "Belum ada tier referral yang memenuhi syarat untuk disetujui." };
        }
      }

      const totalClaimReward = tiersToClaim.reduce((sum, t) => sum + t.reward, 0);

      // READ 3: users/{effectiveReferrerId}
      currentOperation = `READ 3 users/${effectiveReferrerId}`;
      currentPath = `users/${effectiveReferrerId}`;
      const referrerRef = adminDb.doc(`users/${effectiveReferrerId}`);
      const referrerSnap = await tx.get(referrerRef);

      if (!referrerSnap.exists) {
        throw { code: "REFERRER_NOT_FOUND", status: 400, message: `Profil pengundang tidak ditemukan (users/${effectiveReferrerId}).` };
      }

      const referrerData = referrerSnap.data() || {};
      const currentBalance = Number(referrerData.balance ?? 0);
      const referrerName =
        (referrerData.name && String(referrerData.name).trim()) ||
        referralData.referrerName ||
        shortId(effectiveReferrerId);

      // READ 4 & READ 5: referralClaims/{claimId} and rewardLedger/{ledgerId}
      const claimDocsToProcess: Array<{
        claimRef: DocumentReference;
        claimDocId: string;
        claimExists: boolean;
        ledgerRef: DocumentReference;
        ledgerDocId: string;
        ledgerExists: boolean;
        tier: ReferralTierConfig;
      }> = [];

      for (const t of tiersToClaim) {
        const claimDocId = `${actualDocId}_tier_${t.minAcc}`;
        currentOperation = `READ 4 referralClaims/${claimDocId}`;
        currentPath = `referralClaims/${claimDocId}`;
        const claimRef = adminDb.doc(`referralClaims/${claimDocId}`);
        const claimSnap = await tx.get(claimRef);

        const ledgerDocId = `${actualDocId}_ledger_tier_${t.minAcc}`;
        currentOperation = `READ 5 rewardLedger/${ledgerDocId}`;
        currentPath = `rewardLedger/${ledgerDocId}`;
        const ledgerRef = adminDb.doc(`rewardLedger/${ledgerDocId}`);
        const ledgerSnap = await tx.get(ledgerRef);

        claimDocsToProcess.push({
          claimRef,
          claimDocId,
          claimExists: claimSnap.exists,
          ledgerRef,
          ledgerDocId,
          ledgerExists: ledgerSnap.exists,
          tier: t,
        });
      }

      // --- ALL WRITES AFTER READS ---
      currentPhase = "WRITE_PHASE";

      // WRITE 1: referrals/{actualDocId}
      currentOperation = `WRITE 1 referrals/${actualDocId}`;
      currentPath = `referrals/${actualDocId}`;
      const updatedClaimedTiers = { ...claimedTiers };
      tiersToClaim.forEach((t) => {
        updatedClaimedTiers[String(t.minAcc)] = true;
      });

      const newTotalReward = Number(referralData.rewardAmount ?? 0) + totalClaimReward;
      const allClaimed = referralTiers.every((t) => Boolean(updatedClaimedTiers[String(t.minAcc)]));

      const referralUpdates = sanitizePayload({
        claimedTiers: updatedClaimedTiers,
        rewardAmount: newTotalReward,
        status: allClaimed ? "PAID" : "QUALIFIED",
        rewardedAt: FieldValue.serverTimestamp(),
      });
      tx.update(referralSnap.ref, referralUpdates);

      // WRITE 2: users/{effectiveReferrerId}
      currentOperation = `WRITE 2 users/${effectiveReferrerId}`;
      currentPath = `users/${effectiveReferrerId}`;
      tx.update(referrerRef, {
        balance: currentBalance + totalClaimReward,
      });

      // WRITE 3 & WRITE 4: rewardLedger/{ledgerId} & referralClaims/{claimId}
      for (const { claimRef, claimDocId, claimExists, ledgerRef, ledgerDocId, ledgerExists, tier } of claimDocsToProcess) {
        // WRITE 3: rewardLedger/{ledgerId}
        currentOperation = `WRITE 3 rewardLedger/${ledgerDocId}`;
        currentPath = `rewardLedger/${ledgerDocId}`;
        const ledgerData = sanitizePayload({
          id: ledgerDocId,
          workerId: effectiveReferrerId,
          workerName: referrerName,
          rewardType: "referral",
          amount: tier.reward,
          sourceRefId: `${actualDocId}_tier_${tier.minAcc}`,
          description: `Hadiah Referral Tier ${tier.minAcc} ACC (${formatMoney(tier.reward)}) dari pekerja ${effectiveReferredWorkerName}`,
          createdAt: FieldValue.serverTimestamp(),
        });

        if (ledgerExists) {
          tx.update(ledgerRef, ledgerData);
        } else {
          tx.set(ledgerRef, ledgerData);
        }

        // WRITE 4: referralClaims/{claimId}
        currentOperation = `WRITE 4 referralClaims/${claimDocId}`;
        currentPath = `referralClaims/${claimDocId}`;
        const claimData = sanitizePayload({
          id: claimDocId,
          referralId: actualDocId,
          referrerId: effectiveReferrerId,
          referredWorkerId: effectiveReferredWorkerId,
          minAcc: tier.minAcc,
          rewardAmount: tier.reward,
          status: "approved",
          processedAt: FieldValue.serverTimestamp(),
        });

        if (claimExists) {
          tx.update(claimRef, {
            status: "approved",
            processedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.set(claimRef, claimData);
        }
      }

      return {
        referralId: actualDocId,
        effectiveReferrerId,
        totalClaimReward,
        approvedTiers: tiersToClaim.map((t) => t.minAcc),
        status: allClaimed ? "PAID" : "QUALIFIED",
      };
    });

    logger.info(
      {
        authUid: verifiedAuthUid,
        referralId,
        result: result.status,
        totalClaimReward: result.totalClaimReward,
      },
      "[ADMIN REFERRAL APPROVAL] Referral approved successfully"
    );

    res.status(200).json({
      status: "ok",
      message: "Referral berhasil disetujui & hadiah telah dicairkan ke pengundang!",
      data: result,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || (err instanceof Error ? err.message : "Gagal memproses persetujuan referral.");
    const code = err?.code || (err as { code?: string })?.code || "INTERNAL_ERROR";

    logger.error(
      {
        authUid: verifiedAuthUid,
        referralId,
        phase: currentPhase,
        operation: currentOperation,
        path: currentPath,
        code,
        status,
        message,
      },
      "[ADMIN REFERRAL APPROVAL] Server transaction failed"
    );

    res.status(status).json({
      error: message,
      code,
    });
  }
});

export default router;
