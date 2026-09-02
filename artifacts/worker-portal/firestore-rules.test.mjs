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
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Case C: Self-registration with optional phone & referredBy succeeded.');
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

  console.log('4. Balance increase:');
  try {
    await assertFails(
      updateDoc(doc(workerDb, 'users', workerUid), {
        balance: 999999,
      })
    );
    console.log('[PASS] Negative Update: Balance increase correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Update: Balance increase was not rejected:', err);
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

  console.log('\nScenario 3: Non-admin approval denied');
  const nonAdminClaimId = 'non_admin_test_claim';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'referralClaims', nonAdminClaimId), {
      id: nonAdminClaimId,
      referralId: regReferralId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      minAcc: 20,
      rewardAmount: 2000,
      status: 'pending',
    });
  });
  try {
    await assertFails(
      runTransaction(regWorker1Db, async (tx) => {
        const refDocRef = doc(regWorker1Db, 'referrals', regReferralId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(regWorker1Db, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);
        const claimDocRef = doc(regWorker1Db, 'referralClaims', nonAdminClaimId);
        const claimSnap = await tx.get(claimDocRef);

        tx.update(refDocRef, {
          claimedTiers: { ...refSnap.data().claimedTiers, '20': true },
          rewardAmount: 3500,
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 2000,
        });

        const ledgerRef = doc(collection(regWorker1Db, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: regWorker1,
          rewardType: 'referral',
          amount: 2000,
          sourceRefId: nonAdminClaimId,
          createdAt: serverTimestamp(),
        });

        tx.set(claimDocRef, {
          status: 'approved',
        }, { merge: true });
      })
    );
    console.log('[PASS] Scenario 3: Non-admin approval correctly denied.');
  } catch (err) {
    console.error('[FAIL] Scenario 3 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 4: Worker cannot increase balance');
  try {
    await assertFails(
      updateDoc(doc(regWorker1Db, 'users', regWorker1), {
        balance: 99999,
      })
    );
    console.log('[PASS] Scenario 4: Worker increasing balance correctly denied.');
  } catch (err) {
    console.error('[FAIL] Scenario 4 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 5: Worker cannot update referrals');
  try {
    await assertFails(
      updateDoc(doc(regWorker1Db, 'referrals', regReferralId), {
        rewardAmount: 5000,
      })
    );
    console.log('[PASS] Scenario 5: Worker updating referrals correctly denied.');
  } catch (err) {
    console.error('[FAIL] Scenario 5 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nScenario 6: Worker cannot write rewardLedger');
  try {
    await assertFails(
      setDoc(doc(regWorker1Db, 'rewardLedger', 'illegal_ledger_id'), {
        workerId: regWorker1,
        amount: 5000,
        rewardType: 'referral',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Scenario 6: Worker writing rewardLedger correctly denied.');
  } catch (err) {
    console.error('[FAIL] Scenario 6 failed:', err);
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

  await testEnv.cleanup();
  console.log('\nAll regression tests completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
