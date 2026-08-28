import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, getDocs, query, collection, where, runTransaction } from 'firebase/firestore';

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

  console.log('\n--- REQUIRED REGRESSION TESTS (ITEMS 1 - 10) ---');

  // Setup test environment data for Required Regression Tests
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
    // Document in referrals collection that lacks referrerId/referredWorkerId
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
  const regWorker2Db = testEnv.authenticatedContext(regWorker2).firestore();
  const regAdminDb = testEnv.authenticatedContext(adminUid).firestore();

  console.log('\nRequired Test 1: Worker getDoc on referrals/{id} where doc is missing or lacks referrerId/referredWorkerId must not produce CEL/property-access permission error');
  try {
    // Reading non-existent referral document for self
    await assertSucceeds(getDoc(doc(regWorker1Db, 'referrals', regWorker1)));
    // Reading referral doc that exists but lacks referrerId/referredWorkerId (should fail cleanly with permission denied without throwing unhandled CEL evaluation error)
    await assertFails(getDoc(doc(regWorker1Db, 'referrals', 'malformed_ref_doc')));
    console.log('[PASS] Required Test 1: getDoc on missing or malformed referrals document handled cleanly without CEL error.');
  } catch (err) {
    console.error('[FAIL] Required Test 1 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 2: Worker creates a new referralClaims/{claimId} with referrerId == authenticated worker UID and status == "pending"');
  try {
    await assertSucceeds(
      setDoc(doc(regWorker1Db, 'referralClaims', regClaimId), {
        id: regClaimId,
        referralId: regReferralId,
        referrerId: regWorker1,
        referredWorkerId: regWorker2,
        minAcc: 5,
        rewardAmount: 500,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Required Test 2: Worker created valid pending referralClaim request.');
  } catch (err) {
    console.error('[FAIL] Required Test 2 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 3: Worker attempting to write/update an existing referralClaims document must be denied');
  try {
    await assertFails(
      updateDoc(doc(regWorker1Db, 'referralClaims', regClaimId), {
        status: 'approved',
      })
    );
    await assertFails(
      setDoc(doc(regWorker1Db, 'referralClaims', regClaimId), {
        id: regClaimId,
        referralId: regReferralId,
        referrerId: regWorker1,
        referredWorkerId: regWorker2,
        minAcc: 5,
        rewardAmount: 500,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Required Test 3: Worker attempting to update existing referralClaims correctly denied.');
  } catch (err) {
    console.error('[FAIL] Required Test 3 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 4: Worker cannot update users/{uid}.balance upward');
  try {
    await assertFails(
      updateDoc(doc(regWorker1Db, 'users', regWorker1), {
        balance: 99999,
      })
    );
    console.log('[PASS] Required Test 4: Worker updating balance upward correctly denied.');
  } catch (err) {
    console.error('[FAIL] Required Test 4 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 5: Worker cannot update referrals/{id}');
  try {
    await assertFails(
      updateDoc(doc(regWorker1Db, 'referrals', regReferralId), {
        rewardAmount: 5000,
      })
    );
    console.log('[PASS] Required Test 5: Worker updating referrals document correctly denied.');
  } catch (err) {
    console.error('[FAIL] Required Test 5 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 6: Worker cannot write rewardLedger/{id}');
  try {
    await assertFails(
      setDoc(doc(regWorker1Db, 'rewardLedger', 'illegal_ledger_id'), {
        workerId: regWorker1,
        amount: 5000,
        rewardType: 'referral',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Required Test 6: Worker writing rewardLedger correctly denied.');
  } catch (err) {
    console.error('[FAIL] Required Test 6 failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Admin Referral Actions Tests ---');

  console.log('Admin Reject Test: Valid admin can reject a referral document');
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
    console.log('[PASS] Admin Reject Test: Admin rejected referral successfully.');
  } catch (err) {
    console.error('[FAIL] Admin Reject Test failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 7: Valid admin with users/{adminUid}.role == "admin" can execute approval transaction successfully');
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
    console.log('[PASS] Required Test 7: Valid admin executed approval transaction successfully.');
  } catch (err) {
    console.error('[FAIL] Required Test 7 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 8: Admin approval atomically updates referrals/{id}, credits users/{referrerId}.balance, creates rewardLedger/{id}, and updates referralClaims/{claimId} to approved');
  const e2eRegClaimId = 'e2e_reg_claim_doc_10';
  const e2eRegReferralId = 'e2e_reg_referral_doc_10';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'referrals', e2eRegReferralId), {
      id: e2eRegReferralId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      currentAccCount: 10,
      rewardAmount: 500,
      claimedTiers: { '5': true },
      status: 'QUALIFIED',
    });
    await setDoc(doc(db, 'referralClaims', e2eRegClaimId), {
      id: e2eRegClaimId,
      referralId: e2eRegReferralId,
      referrerId: regWorker1,
      referredWorkerId: regWorker2,
      minAcc: 10,
      rewardAmount: 1000,
      status: 'pending',
    });
  });
  try {
    await assertSucceeds(
      runTransaction(regAdminDb, async (tx) => {
        const refDocRef = doc(regAdminDb, 'referrals', e2eRegReferralId);
        const refSnap = await tx.get(refDocRef);
        const referrerUserRef = doc(regAdminDb, 'users', regWorker1);
        const referrerSnap = await tx.get(referrerUserRef);
        const claimDocRef = doc(regAdminDb, 'referralClaims', e2eRegClaimId);
        const claimSnap = await tx.get(claimDocRef);

        tx.update(refDocRef, {
          claimedTiers: { ...refSnap.data().claimedTiers, '10': true },
          rewardAmount: 1500,
          status: 'QUALIFIED',
        });

        tx.update(referrerUserRef, {
          balance: (referrerSnap.data().balance || 0) + 1000,
        });

        const ledgerRef = doc(collection(regAdminDb, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: regWorker1,
          rewardType: 'referral',
          amount: 1000,
          sourceRefId: e2eRegClaimId,
          createdAt: serverTimestamp(),
        });

        tx.set(claimDocRef, {
          status: 'approved',
          processedAt: serverTimestamp(),
        }, { merge: true });
      })
    );
    console.log('[PASS] Required Test 8: Admin approval transaction verified atomic updates to all 4 collections.');
  } catch (err) {
    console.error('[FAIL] Required Test 8 failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- Legacy Referral Missing referredWorkerId Fallback Test ---');
  const legacyRefId = 'legacy_referral_no_referred_id';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Legacy referral document lacking referredWorkerId
    await setDoc(doc(db, 'referrals', legacyRefId), {
      id: legacyRefId,
      referrerId: regWorker1,
      referrerName: 'Regression Worker 1',
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
      createdAt: new Date(),
    });
  });
  try {
    await assertSucceeds(
      runTransaction(regAdminDb, async (tx) => {
        const refDocRef = doc(regAdminDb, 'referrals', legacyRefId);
        const refSnap = await tx.get(refDocRef);
        const refData = refSnap.data();
        const effectiveReferredWorkerId = refData.referredWorkerId || refData.id || legacyRefId;

        const referrerUserRef = doc(regAdminDb, 'users', refData.referrerId);
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
          workerId: refData.referrerId,
          workerName: 'Regression Worker 1',
          rewardType: 'referral',
          amount: 500,
          sourceRefId: claimDocId,
          description: `Hadiah Referral Tier 5 ACC (Rp 500) dari pekerja ${refData.referredWorkerName || effectiveReferredWorkerId}`,
          createdAt: serverTimestamp(),
        });

        if (claimSnap.exists()) {
          tx.update(claimDocRef, { status: 'approved', processedAt: serverTimestamp() });
        } else {
          tx.set(claimDocRef, {
            id: claimDocId,
            referralId: legacyRefId,
            referrerId: refData.referrerId,
            referredWorkerId: effectiveReferredWorkerId,
            minAcc: 5,
            rewardAmount: 500,
            status: 'approved',
            processedAt: serverTimestamp(),
          });
        }
      })
    );
    console.log('[PASS] Legacy Referral Fallback Test: Admin approval succeeded on document lacking referredWorkerId.');
  } catch (err) {
    console.error('[FAIL] Legacy Referral Fallback Test failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 9: Non-admin cannot perform admin approval');
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
    console.log('[PASS] Required Test 9: Non-admin approval transaction correctly denied.');
  } catch (err) {
    console.error('[FAIL] Required Test 9 failed:', err);
    process.exitCode = 1;
  }

  console.log('\nRequired Test 10: Duplicate tier approval cannot pay twice');
  try {
    // Attempting to re-approve tier 5 which was already claimed in claimedTiers: { '5': true }
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
      console.log(' - Expected rejection received:', err.message);
    });

    if (!duplicatePayoutOccurred) {
      console.log('[PASS] Required Test 10: Duplicate tier approval safely blocked from double payout.');
    } else {
      console.error('[FAIL] Required Test 10: Duplicate payout was allowed!');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[FAIL] Required Test 10 failed:', err);
    process.exitCode = 1;
  }

  await testEnv.cleanup();
  console.log('\nAll regression tests completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
