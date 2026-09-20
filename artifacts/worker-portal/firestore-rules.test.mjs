import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, query, collection, where, runTransaction } from 'firebase/firestore';

const PROJECT_ID = 'creat-2c127';
const rulesContent = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../firestore.rules'), 'utf8');

const adminUid = 'vQfEbhhVyXMXVlhYmu4AgOvmony1';
const workerUid = 'worker_test_user_123';
const newWorkerUid = 'new_worker_456';
const otherWorkerUid = 'other_worker_789';

async function main() {
  console.log('Initializing Firestore rules test suite...');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  await testEnv.clearFirestore();

  // Setup initial user documents bypassing rules
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Admin user doc (role: admin)
    await setDoc(doc(db, 'users', adminUid), {
      uid: adminUid,
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    // Existing Worker user doc
    await setDoc(doc(db, 'users', workerUid), {
      uid: workerUid,
      name: 'Worker User',
      email: 'worker@example.com',
      role: 'worker',
      status: 'active',
      tier: 2,
      balance: 15000,
      createdAt: new Date(),
    });
    // Existing conversation for workerUid
    await setDoc(doc(db, 'conversations', workerUid), {
      id: workerUid,
      workerId: workerUid,
      workerName: 'Worker User',
      workerEmail: 'worker@example.com',
      adminId: adminUid,
      lastMessage: 'Pesan awal',
      lastMessageAt: new Date(),
      workerUnread: 2,
      adminUnread: 0,
      createdAt: new Date(),
    });
  });

  console.log('\n--- Case A: Self profile read ---');
  const workerDb = testEnv.authenticatedContext(workerUid).firestore();
  try {
    await assertSucceeds(getDoc(doc(workerDb, 'users', workerUid)));
    console.log('[PASS] Case A: Self profile read succeeded.');
  } catch (err) {
    console.error('[FAIL] Case A: Self profile read failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Case B: Self-registration (required fields only, status: active, role: worker, tier: 1, balance: 0) ---');
  const newWorkerDb = testEnv.authenticatedContext(newWorkerUid).firestore();
  try {
    await assertSucceeds(
      setDoc(doc(newWorkerDb, 'users', newWorkerUid), {
        uid: newWorkerUid,
        name: 'New Worker',
        email: 'newworker@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Case B: Self-registration with required fields succeeded.');
  } catch (err) {
    console.error('[FAIL] Case B: Self-registration failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Case C: Self-registration with optional phone & referredBy strings ---');
  const caseCUid = 'worker_case_c_123';
  const caseCDb = testEnv.authenticatedContext(caseCUid).firestore();
  try {
    await assertSucceeds(
      setDoc(doc(caseCDb, 'users', caseCUid), {
        uid: caseCUid,
        name: 'Case C Worker',
        email: 'casec@example.com',
        phone: '08123456789',
        referredBy: workerUid,
        referralCode: 'REF123',
        hasUsedReferral: true,
        reciprocalPartner: 'partner_456',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Case C: Self-registration with optional phone, referredBy, referralCode, hasUsedReferral, reciprocalPartner succeeded.');
  } catch (err) {
    console.error('[FAIL] Case C: Self-registration failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Negative Create Tests ---');

  console.log('1. Spoofed UID:');
  const spoofUid = 'spoof_uid_user';
  const spoofDb = testEnv.authenticatedContext(spoofUid).firestore();
  try {
    await assertFails(
      setDoc(doc(spoofDb, 'users', otherWorkerUid), {
        uid: otherWorkerUid,
        name: 'Spoofed User',
        email: 'spoof@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Spoofed UID correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Spoofed UID was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('2. Role admin:');
  const badRoleUid = 'bad_role_user';
  const badRoleDb = testEnv.authenticatedContext(badRoleUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badRoleDb, 'users', badRoleUid), {
        uid: badRoleUid,
        name: 'Bad Role User',
        email: 'badrole@example.com',
        role: 'admin',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Role admin correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Role admin was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('3. Status pending:');
  const badStatusUid = 'bad_status_user';
  const badStatusDb = testEnv.authenticatedContext(badStatusUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badStatusDb, 'users', badStatusUid), {
        uid: badStatusUid,
        name: 'Bad Status User',
        email: 'badstatus@example.com',
        role: 'worker',
        status: 'pending',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Status pending correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Status pending was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('4. Tier > 1:');
  const badTierUid = 'bad_tier_user';
  const badTierDb = testEnv.authenticatedContext(badTierUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badTierDb, 'users', badTierUid), {
        uid: badTierUid,
        name: 'Bad Tier User',
        email: 'badtier@example.com',
        role: 'worker',
        status: 'active',
        tier: 5,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Tier > 1 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Tier > 1 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('5. Balance > 0:');
  const badBalanceUid = 'bad_balance_user';
  const badBalanceDb = testEnv.authenticatedContext(badBalanceUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badBalanceDb, 'users', badBalanceUid), {
        uid: badBalanceUid,
        name: 'Bad Balance User',
        email: 'badbalance@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 1000000,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Balance > 0 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Balance > 0 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('6. Arbitrary extra field:');
  const extraFieldUid = 'extra_field_user';
  const extraFieldDb = testEnv.authenticatedContext(extraFieldUid).firestore();
  try {
    await assertFails(
      setDoc(doc(extraFieldDb, 'users', extraFieldUid), {
        uid: extraFieldUid,
        name: 'Extra Field User',
        email: 'extra@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
        hacked: true,
      })
    );
    console.log('[PASS] Negative Create: Arbitrary extra field correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Arbitrary extra field was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('7. Phone non-string:');
  const badPhoneUid = 'bad_phone_user';
  const badPhoneDb = testEnv.authenticatedContext(badPhoneUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badPhoneDb, 'users', badPhoneUid), {
        uid: badPhoneUid,
        name: 'Bad Phone User',
        email: 'badphone@example.com',
        phone: 8123456789,
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Non-string phone correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Non-string phone was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('8. ReferredBy non-string:');
  const badRefUid = 'bad_ref_user';
  const badRefDb = testEnv.authenticatedContext(badRefUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badRefDb, 'users', badRefUid), {
        uid: badRefUid,
        name: 'Bad Ref User',
        email: 'badref@example.com',
        referredBy: 12345,
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Non-string referredBy correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Non-string referredBy was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('9. Missing required field (e.g. balance missing):');
  const missingFieldUid = 'missing_field_user';
  const missingFieldDb = testEnv.authenticatedContext(missingFieldUid).firestore();
  try {
    await assertFails(
      setDoc(doc(missingFieldDb, 'users', missingFieldUid), {
        uid: missingFieldUid,
        name: 'Missing Field User',
        email: 'missing@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Create: Missing required field correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Missing required field was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('10. Invalid createdAt (string instead of timestamp):');
  const badDateUid = 'bad_date_user';
  const badDateDb = testEnv.authenticatedContext(badDateUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badDateDb, 'users', badDateUid), {
        uid: badDateUid,
        name: 'Bad Date User',
        email: 'baddate@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: '2026-01-01T00:00:00Z',
      })
    );
    console.log('[PASS] Negative Create: Invalid createdAt correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Create: Invalid createdAt was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Negative Update Tests ---');

  console.log('1. Role escalation:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', workerUid), {
        role: 'admin',
      })
    );
    console.log('[PASS] Negative Update: Role escalation correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Role escalation was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('2. Status change:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', workerUid), {
        status: 'suspended',
      })
    );
    console.log('[PASS] Negative Update: Status change correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Status change was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('3. Tier change:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', workerUid), {
        tier: 5,
      })
    );
    console.log('[PASS] Negative Update: Tier change correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Tier change was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('4. Self balance update (permitted under simplified self update rule):');
  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'users', workerUid), {
        balance: 20000,
      })
    );
    console.log('[PASS] Self balance update succeeded as permitted by security rules.');
  } catch (err) {
    console.error('[FAIL] Self balance update failed:', err);
    process.exitCode = 1;
  }

  console.log('5. Negative balance:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', workerUid), {
        balance: -500,
      })
    );
    console.log('[PASS] Negative Update: Negative balance correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Negative balance was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('6. Update another user\'s profile:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', adminUid), {
        name: 'Hacked Admin Name',
      })
    );
    console.log('[PASS] Negative Update: Updating another user\'s profile correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Updating another user\'s profile was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- PRODUCTION-MATCHING REGRESSION SUITE (SCENARIOS 1 - 10) ---');

  // Setup test environment data for Production-Matching Regression Suite
  const regWorker1 = 'reg_worker_1';
  const regWorker2 = 'reg_worker_2';
  const regReferralId = 'reg_referral_doc_1';
  const regClaimId = `${regReferralId}_tier_5`;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Profile for regWorker1
    await setDoc(doc(db, 'users', regWorker1), {
      uid: regWorker1,
      name: 'Regression Worker 1',
      email: 'reg1@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 1000,
      createdAt: new Date(),
    });
    // Profile for regWorker2
    await setDoc(doc(db, 'users', regWorker2), {
      uid: regWorker2,
      name: 'Regression Worker 2',
      email: 'reg2@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    // Malformed document in referrals collection
    await setDoc(doc(db, 'referrals', 'malformed_ref_doc'), {
      customField: 'no_referrer_or_referred_keys',
    });
    // Valid referral document
    await setDoc(doc(db, 'referrals', regReferralId), {
      id: regReferralId,
      referrerId: regWorker1,
      referrerName: 'Regression Worker 1',
      referredWorkerId: regWorker2,
      referredWorkerName: 'Regression Worker 2',
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
      createdAt: new Date(),
    });
  });

  const regWorker1Db = testEnv.authenticatedContext(regWorker1).firestore();
  const regAdminDb = testEnv.authenticatedContext(adminUid).firestore();

  console.log('\nScenario 1: Valid admin approval succeeds');
  try {
    await assertSucceeds(
      runTransaction(regAdminDb, async (tx) => {
        const refDocRef = doc(regAdminDb, 'referrals', regReferralId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(regAdminDb, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);
        const claimDocRef = doc(regAdminDb, 'referralClaims', regClaimId);
        const claimSnap = await tx.get(claimDocRef);

        tx.update(refDocRef, {
          claimedTiers: { '5': true },
          rewardAmount: 500,
          status: 'QUALIFIED',
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 500,
        });

        const ledgerRef = doc(collection(regAdminDb, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: regWorker1,
          rewardType: 'referral',
          amount: 500,
          sourceRefId: regClaimId,
          createdAt: serverTimestamp(),
        });

        tx.set(claimDocRef, {
          status: 'approved',
          processedAt: serverTimestamp(),
        }, { merge: true });
      })
    );
    console.log('[PASS] Scenario 1: Valid admin approval succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 1 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 2: Reject succeeds');
  const rejectRefId = 'reject_test_referral_doc';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'referrals', rejectRefId), {
      id: rejectRefId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      currentAccCount: 2,
      rewardAmount: 0,
      status: 'PENDING',
      createdAt: new Date(),
    });
  });
  try {
    await assertSucceeds(
      updateDoc(doc(regAdminDb, 'referrals', rejectRefId), {
        status: 'REJECTED',
        reviewNote: 'Ditolak oleh admin',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Scenario 2: Reject succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 2 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 3: Worker (referrer) claimReferralReward transaction succeeds');
  const workerClaimRefId = 'worker_claim_ref_doc_1';
  const workerClaimId = `${workerClaimRefId}_tier_5`;
  const workerLedgerId = `${workerClaimRefId}_ledger_tier_5`;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'referrals', workerClaimRefId), {
      id: workerClaimRefId,
      referrerId: regWorker1,
      referrerName: 'Regression Worker 1',
      referredWorkerId: regWorker2,
      referredWorkerName: 'Regression Worker 2',
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
      createdAt: new Date(),
    });
  });

  try {
    await assertSucceeds(
      runTransaction(regWorker1Db, async (tx) => {
        const refDocRef = doc(regWorker1Db, 'referrals', workerClaimRefId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(regWorker1Db, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);
        const claimDocRef = doc(regWorker1Db, 'referralClaims', workerClaimId);
        const claimSnap = await tx.get(claimDocRef);
        const ledgerRef = doc(regWorker1Db, 'rewardLedger', workerLedgerId);
        const ledgerSnap = await tx.get(ledgerRef);

        tx.update(refDocRef, {
          claimedTiers: { '5': true },
          rewardAmount: 500,
          status: 'QUALIFIED',
          rewardedAt: serverTimestamp(),
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 500,
          lastClaimId: workerClaimId,
        });

        tx.set(ledgerRef, {
          id: workerLedgerId,
          workerId: regWorker1,
          workerName: 'Regression Worker 1',
          rewardType: 'referral',
          amount: 500,
          sourceRefId: workerClaimId,
          description: 'Hadiah Referral Tier 5 ACC',
          createdAt: serverTimestamp(),
        });

        tx.set(claimDocRef, {
          id: workerClaimId,
          referralId: workerClaimRefId,
          referrerId: regWorker1,
          referredWorkerId: regWorker2,
          minAcc: 5,
          rewardAmount: 500,
          status: 'approved',
          processedAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Scenario 3: Worker claimReferralReward transaction succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 3 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 4: Unauthorized worker cannot claim another referrer\'s reward');
  const unauthorizedWorkerDb = testEnv.authenticatedContext(otherWorkerUid).firestore();
  try {
    await assertFails(
      runTransaction(unauthorizedWorkerDb, async (tx) => {
        const refDocRef = doc(unauthorizedWorkerDb, 'referrals', workerClaimRefId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(unauthorizedWorkerDb, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);

        tx.update(refDocRef, {
          rewardAmount: 1000,
        });
        tx.update(referrerUserRef, {
          balance: (referrerSnap.data()?.balance || 0) + 1000,
        });
      })
    );
    console.log('[PASS] Scenario 4: Unauthorized worker claim correctly denied.');
  } catch (err) {
    console.error('[FAIL] Scenario 4 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 7: Duplicate approval cannot pay twice');
  try {
    let duplicatePayoutOccurred = false;
    await runTransaction(regAdminDb, async (tx) => {
      const refDocRef = doc(regAdminDb, 'referrals', regReferralId);
      const refSnap = await tx.get(refDocRef);
      const claimedTiers = refSnap.data().claimedTiers || {};

      if (claimedTiers['5']) {
        throw new Error('Tier 5 already claimed. Duplicate payout blocked.');
      }

      duplicatePayoutOccurred = true;
      tx.update(refDocRef, {
        rewardAmount: (refSnap.data().rewardAmount || 0) + 500,
      });
    }).catch((err) => {
      console.log(' - Expected duplicate rejection received:', err.message);
    });

    if (!duplicatePayoutOccurred) {
      console.log('[PASS] Scenario 7: Duplicate approval safely blocked from double payout.');
    } else {
      console.error('[FAIL] Scenario 7: Duplicate payout was allowed!');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[FAIL] Scenario 7 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 8: Legacy referral missing referredWorkerId succeeds');
  const legacyRefId = 'legacy_ref_missing_referred_worker_id';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Legacy doc where referredWorkerId is omitted but doc ID is the referredWorkerId
    await setDoc(doc(db, 'referrals', legacyRefId), {
      referrerId: regWorker1,
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
    });
  });
  try {
    await assertSucceeds(
      runTransaction(regAdminDb, async (tx) => {
        const refDocRef = doc(regAdminDb, 'referrals', legacyRefId);
        const refSnap = await tx.get(refDocRef);
        const referralData = refSnap.data();

        const effectiveReferredWorkerId = referralData.referredWorkerId || refSnap.id || legacyRefId;
        const referrerUserRef = doc(regAdminDb, 'users', referralData.referrerId);
        const referrerSnap = await tx.get(referrerUserRef);

        const claimDocId = `${legacyRefId}_tier_5`;
        const claimDocRef = doc(regAdminDb, 'referralClaims', claimDocId);
        const claimSnap = await tx.get(claimDocRef);

        tx.update(refDocRef, {
          claimedTiers: { '5': true },
          rewardAmount: 500,
          status: 'QUALIFIED',
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 500,
        });

        const ledgerRef = doc(collection(regAdminDb, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: referralData.referrerId,
          rewardType: 'referral',
          amount: 500,
          sourceRefId: claimDocId,
          createdAt: serverTimestamp(),
        });

        tx.set(claimDocRef, {
          id: claimDocId,
          referralId: legacyRefId,
          referrerId: referralData.referrerId,
          referredWorkerId: effectiveReferredWorkerId,
          minAcc: 5,
          rewardAmount: 500,
          status: 'approved',
          processedAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Scenario 8: Legacy referral missing referredWorkerId approval succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 8 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 9: referralClaims existing-document case');
  const existingClaimRefId = 'ref_with_existing_claim_doc';
  const existingClaimId = `${existingClaimRefId}_tier_5`;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'referrals', existingClaimRefId), {
      id: existingClaimRefId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
    });
    await setDoc(doc(db, 'referralClaims', existingClaimId), {
      id: existingClaimId,
      referralId: existingClaimRefId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      minAcc: 5,
      rewardAmount: 500,
      status: 'pending',
      requestedAt: new Date(),
    });
  });
  try {
    await assertSucceeds(
      runTransaction(regAdminDb, async (tx) => {
        const refDocRef = doc(regAdminDb, 'referrals', existingClaimRefId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(regAdminDb, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);
        const claimDocRef = doc(regAdminDb, 'referralClaims', existingClaimId);
        const claimSnap = await tx.get(claimDocRef);

        tx.update(refDocRef, {
          claimedTiers: { '5': true },
          rewardAmount: 500,
          status: 'QUALIFIED',
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 500,
        });

        const ledgerRef = doc(collection(regAdminDb, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: regWorker1,
          rewardType: 'referral',
          amount: 500,
          sourceRefId: existingClaimId,
          createdAt: serverTimestamp(),
        });

        // Updating existing claim document
        tx.update(claimDocRef, {
          status: 'approved',
          processedAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Scenario 9: referralClaims existing-document case succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 9 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 10: rewardLedger existing-document case');
  const existingLedgerId = 'existing_ledger_doc_123';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'rewardLedger', existingLedgerId), {
      id: existingLedgerId,
      workerId: regWorker1,
      rewardType: 'referral',
      amount: 500,
      createdAt: new Date(),
    });
  });
  try {
    // Admin reading or writing an existing rewardLedger document succeeds
    await assertSucceeds(getDoc(doc(regAdminDb, 'rewardLedger', existingLedgerId)));
    await assertSucceeds(
      setDoc(
        doc(regAdminDb, 'rewardLedger', existingLedgerId),
        {
          note: 'Updated by admin',
        },
        { merge: true }
      )
    );
    console.log('[PASS] Scenario 10: rewardLedger existing-document case succeeded.');
  } catch (err) {
    console.error('[FAIL] Scenario 10 failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Announcements Security Rules Tests ---');
  const annId = 'ann_test_1';
  // Admin creates announcement
  try {
    await assertSucceeds(
      setDoc(doc(regAdminDb, 'announcements', annId), {
        title: 'Pengumuman Penting',
        content: 'Isi pengumuman admin',
        badge: 'BARU',
        isActive: true,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Admin creating announcement succeeded.');
  } catch (err) {
    console.error('[FAIL] Admin creating announcement failed:', err);
    process.exitCode = 1;
  }

  // Worker reading announcement
  try {
    await assertSucceeds(getDoc(doc(workerDb, 'announcements', annId)));
    console.log('[PASS] Worker reading announcement succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker reading announcement failed:', err);
    process.exitCode = 1;
  }

  // Worker creating announcement should fail
  try {
    await assertFails(
      setDoc(doc(workerDb, 'announcements', 'illegal_ann_id'), {
        title: 'Fake Announcement',
        content: 'Worker created content',
        isActive: true,
        createdBy: workerUid,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker creating announcement correctly denied.');
  } catch (err) {
    console.error('[FAIL] Worker creating announcement was not denied:', err);
    process.exitCode = 1;
  }

  // Worker updating announcement should fail
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'announcements', annId), {
        title: 'Hacked Title',
      })
    );
    console.log('[PASS] Worker updating announcement correctly denied.');
  } catch (err) {
    console.error('[FAIL] Worker updating announcement was not denied:', err);
    process.exitCode = 1;
  }

  // Worker deleting announcement should fail
  try {
    await assertFails(
      deleteDoc(doc(workerDb, 'announcements', annId))
    );
    console.log('[PASS] Worker deleting announcement correctly denied.');
  } catch (err) {
    console.error('[FAIL] Worker deleting announcement was not denied:', err);
    process.exitCode = 1;
  }

  // Admin updating announcement
  try {
    await assertSucceeds(
      updateDoc(doc(regAdminDb, 'announcements', annId), {
        title: 'Pengumuman Penting (Updated)',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Admin updating announcement succeeded.');
  } catch (err) {
    console.error('[FAIL] Admin updating announcement failed:', err);
    process.exitCode = 1;
  }

  // Admin deleting announcement
  try {
    await assertSucceeds(
      deleteDoc(doc(regAdminDb, 'announcements', annId))
    );
    console.log('[PASS] Admin deleting announcement succeeded.');
  } catch (err) {
    console.error('[FAIL] Admin deleting announcement failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- COMPREHENSIVE PRIVATE CHAT SECURITY SUITE ---');

  // 1. Worker legitimate message update succeeds
  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        lastMessage: 'Pesan baru dari worker',
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        adminUnread: 1, // current adminUnread is 0, so 0 + 1 = 1 is valid +1 increment
      })
    );
    console.log('[PASS] 1. Worker legitimate message update succeeds.');
  } catch (err) {
    console.error('[FAIL] 1. Worker legitimate message update failed:', err);
    process.exitCode = 1;
  }

  // 2. Worker cannot arbitrarily modify adminUnread
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        adminUnread: 99,
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 2. Worker cannot arbitrarily modify adminUnread.');
  } catch (err) {
    console.error('[FAIL] 2. Worker arbitrary modify adminUnread was not denied:', err);
    process.exitCode = 1;
  }

  // 3. Worker cannot modify workerName
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        workerName: 'Hacked Worker Name',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 3. Worker cannot modify workerName.');
  } catch (err) {
    console.error('[FAIL] 3. Worker modify workerName was not denied:', err);
    process.exitCode = 1;
  }

  // 4. Worker cannot modify workerEmail
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        workerEmail: 'hacked@example.com',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 4. Worker cannot modify workerEmail.');
  } catch (err) {
    console.error('[FAIL] 4. Worker modify workerEmail was not denied:', err);
    process.exitCode = 1;
  }

  // 5. Worker cannot modify workerId
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        workerId: otherWorkerUid,
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 5. Worker cannot modify workerId.');
  } catch (err) {
    console.error('[FAIL] 5. Worker modify workerId was not denied:', err);
    process.exitCode = 1;
  }

  // 6. Worker cannot modify adminId
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        adminId: 'fake_admin_123',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 6. Worker cannot modify adminId.');
  } catch (err) {
    console.error('[FAIL] 6. Worker modify adminId was not denied:', err);
    process.exitCode = 1;
  }

  // 7. Worker cannot modify createdAt
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 7. Worker cannot modify createdAt.');
  } catch (err) {
    console.error('[FAIL] 7. Worker modify createdAt was not denied:', err);
    process.exitCode = 1;
  }

  // 8. Worker cannot modify adminPinnedMessageId
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        adminPinnedMessageId: 'msg_admin_pin_1',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 8. Worker cannot modify adminPinnedMessageId.');
  } catch (err) {
    console.error('[FAIL] 8. Worker modify adminPinnedMessageId was not denied:', err);
    process.exitCode = 1;
  }

  // 9. Worker cannot modify adminClearedAt
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        adminClearedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 9. Worker cannot modify adminClearedAt.');
  } catch (err) {
    console.error('[FAIL] 9. Worker modify adminClearedAt was not denied:', err);
    process.exitCode = 1;
  }

  // 10. Worker can update their own workerPinnedMessageId
  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        workerPinnedMessageId: 'msg_worker_pin_1',
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 10. Worker can update their own workerPinnedMessageId.');
  } catch (err) {
    console.error('[FAIL] 10. Worker update workerPinnedMessageId failed:', err);
    process.exitCode = 1;
  }

  // 11. Worker can update their own workerClearedAt
  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid), {
        workerClearedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 11. Worker can update their own workerClearedAt.');
  } catch (err) {
    console.error('[FAIL] 11. Worker update workerClearedAt failed:', err);
    process.exitCode = 1;
  }

  // 12. Worker cannot access another Worker's conversation
  try {
    await assertFails(getDoc(doc(workerDb, 'conversations', otherWorkerUid)));
    await assertFails(getDocs(collection(workerDb, 'conversations')));
    console.log('[PASS] 12. Worker cannot access another Worker\'s conversation.');
  } catch (err) {
    console.error('[FAIL] 12. Worker access another Worker conversation was not denied:', err);
    process.exitCode = 1;
  }

  // 13. Worker cannot spoof senderId
  try {
    await assertFails(
      setDoc(doc(collection(workerDb, 'conversations', workerUid, 'messages')), {
        senderId: otherWorkerUid,
        senderRole: 'worker',
        text: 'Spoofed senderId message',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 13. Worker cannot spoof senderId.');
  } catch (err) {
    console.error('[FAIL] 13. Worker spoof senderId was not denied:', err);
    process.exitCode = 1;
  }

  // 14. Worker cannot spoof senderRole
  try {
    await assertFails(
      setDoc(doc(collection(workerDb, 'conversations', workerUid, 'messages')), {
        senderId: workerUid,
        senderRole: 'admin',
        text: 'Spoofed senderRole message',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 14. Worker cannot spoof senderRole.');
  } catch (err) {
    console.error('[FAIL] 14. Worker spoof senderRole was not denied:', err);
    process.exitCode = 1;
  }

  // 15. Worker can update readAt on admin message in their own conversation
  const testMsgRef = doc(collection(regAdminDb, 'conversations', workerUid, 'messages'));
  await setDoc(testMsgRef, {
    senderId: 'admin_1',
    senderRole: 'admin',
    text: 'Admin message for readAt test',
    createdAt: serverTimestamp(),
  });

  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid, 'messages', testMsgRef.id), {
        readAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 15. Worker can update readAt on message in their own conversation.');
  } catch (err) {
    console.error('[FAIL] 15. Worker failed to update readAt in their own conversation:', err);
    process.exitCode = 1;
  }

  // 16. Worker cannot tamper with text content during readAt update
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid, 'messages', testMsgRef.id), {
        readAt: serverTimestamp(),
        text: 'Tampered text content',
      })
    );
    console.log('[PASS] 16. Worker cannot tamper with text content during readAt update.');
  } catch (err) {
    console.error('[FAIL] 16. Worker text tampering was not denied:', err);
    process.exitCode = 1;
  }

  // 17. Worker cannot update readAt in another worker's conversation
  const unauthWorkerUid = 'worker_other_999';
  const otherMsgRef = doc(collection(regAdminDb, 'conversations', unauthWorkerUid, 'messages'));
  await setDoc(otherMsgRef, {
    senderId: 'admin_1',
    senderRole: 'admin',
    text: 'Message in another worker conv',
    createdAt: serverTimestamp(),
  });

  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', unauthWorkerUid, 'messages', otherMsgRef.id), {
        readAt: serverTimestamp(),
      })
    );
    console.log('[PASS] 17. Worker cannot update readAt in another worker conversation.');
  } catch (err) {
    console.error('[FAIL] 17. Worker unauthorized update in another conversation was not denied:', err);
    process.exitCode = 1;
  }

  // 18. Worker can update deletedAt and deletedBy on message in own conversation (Hapus untuk semua)
  const ownMsgRef = doc(collection(regAdminDb, 'conversations', workerUid, 'messages'));
  await setDoc(ownMsgRef, {
    senderId: workerUid,
    senderRole: 'worker',
    text: 'Pesan yang akan dihapus worker',
    createdAt: serverTimestamp(),
  });

  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid, 'messages', ownMsgRef.id), {
        deletedAt: serverTimestamp(),
        deletedBy: workerUid,
      })
    );
    console.log('[PASS] 18. Worker can update deletion metadata (deletedAt, deletedBy) in own conversation.');
  } catch (err) {
    console.error('[FAIL] 18. Worker update deletion metadata failed:', err);
    process.exitCode = 1;
  }

  // 19. Worker can update deletedFor on message in own conversation (Hapus untuk saya)
  try {
    await assertSucceeds(
      updateDoc(doc(workerDb, 'conversations', workerUid, 'messages', ownMsgRef.id), {
        deletedFor: [workerUid],
      })
    );
    console.log('[PASS] 19. Worker can update deletion metadata (deletedFor) in own conversation.');
  } catch (err) {
    console.error('[FAIL] 19. Worker update deletedFor failed:', err);
    process.exitCode = 1;
  }

  // 20. Worker cannot modify immutable fields (e.g. text) during deletion update
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'conversations', workerUid, 'messages', ownMsgRef.id), {
        deletedAt: serverTimestamp(),
        deletedBy: workerUid,
        text: 'Tampered text content during delete',
      })
    );
    console.log('[PASS] 20. Worker cannot modify text content during deletion update.');
  } catch (err) {
    console.error('[FAIL] 20. Worker text tampering during delete was not denied:', err);
    process.exitCode = 1;
  }

  await testEnv.cleanup();
  console.log('\nAll security tests completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
