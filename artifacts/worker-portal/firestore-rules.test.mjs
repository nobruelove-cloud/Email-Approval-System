import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, getDocs, query, collection, where } from 'firebase/firestore';

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
    // Admin user doc
    await setDoc(doc(db, 'users', adminUid), {
      uid: adminUid,
      name: 'Admin User',
      email: 'mandarawanzz@gmail.com',
      role: 'Admin',
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

  console.log('\n--- Additional Collection Security Rules Regression Tests (H through T) ---');

  console.log('TEST H: Worker missionClaim creation:');
  const existingWorkerDb = testEnv.authenticatedContext(workerUid).firestore();
  const missionClaimId = `${workerUid}_daily_acc_3_2026-W34`;
  try {
    await assertSucceeds(
      setDoc(doc(existingWorkerDb, 'missionClaims', missionClaimId), {
        id: missionClaimId,
        workerId: workerUid,
        missionId: 'daily_acc_3',
        periodKey: '2026-W34',
        workerName: 'Worker User',
        status: 'pending',
        requestedAt: serverTimestamp(),
      }, { merge: true })
    );
    console.log('[PASS] Worker missionClaim creation succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker missionClaim creation failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST I: Worker attempting status "approved" in missionClaim fails:');
  const badClaimId = `${workerUid}_bad_claim`;
  try {
    await assertFails(
      setDoc(doc(existingWorkerDb, 'missionClaims', badClaimId), {
        id: badClaimId,
        workerId: workerUid,
        missionId: 'daily_acc_3',
        periodKey: '2026-W34',
        workerName: 'Worker User',
        status: 'approved',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker attempting status "approved" in missionClaim correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting status "approved" in missionClaim was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('TEST J: Worker financialTransactions access fails:');
  const finTxId = 'fin_tx_123';
  try {
    await assertFails(
      setDoc(doc(existingWorkerDb, 'financialTransactions', finTxId), {
        type: 'income',
        amount: 500000,
        description: 'Unauthorized Income',
        period: '2026-08',
      })
    );
    await assertFails(getDoc(doc(existingWorkerDb, 'financialTransactions', finTxId)));
    console.log('[PASS] Worker access to financialTransactions correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker access to financialTransactions was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('TEST K: Admin financialTransactions access succeeds:');
  const adminDb = testEnv.authenticatedContext(adminUid).firestore();
  try {
    await assertSucceeds(
      setDoc(doc(adminDb, 'financialTransactions', finTxId), {
        id: finTxId,
        type: 'income',
        amount: 500000,
        description: 'Penjualan Storage Gmail',
        period: '2026-08',
        transactionDate: new Date(),
        createdAt: serverTimestamp(),
      })
    );
    await assertSucceeds(getDoc(doc(adminDb, 'financialTransactions', finTxId)));
    console.log('[PASS] Admin access to financialTransactions succeeded.');
  } catch (err) {
    console.error('[FAIL] Admin access to financialTransactions failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST L: Worker creating valid referral relationship for self succeeds:');
  const refDocId = newWorkerUid;
  try {
    await assertSucceeds(
      setDoc(doc(newWorkerDb, 'referrals', refDocId), {
        id: refDocId,
        referrerId: workerUid,
        referrerName: 'Worker User',
        referredWorkerId: newWorkerUid,
        referredWorkerName: 'New Worker',
        currentAccCount: 0,
        rewardAmount: 0,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker creating valid referral relationship succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker creating valid referral relationship failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST M: Worker attempting create referral for another worker fails:');
  try {
    await assertFails(
      setDoc(doc(newWorkerDb, 'referrals', otherWorkerUid), {
        id: otherWorkerUid,
        referrerId: workerUid,
        referrerName: 'Worker User',
        referredWorkerId: otherWorkerUid,
        referredWorkerName: 'Spoofed Referred',
        currentAccCount: 0,
        rewardAmount: 0,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker attempting create referral for another worker correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting create referral for another worker was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('TEST N: Worker reading non-existent referral document for self succeeds:');
  const nonExistentSelfRefUid = 'unregistered_ref_worker_123';
  const nonExistentSelfDb = testEnv.authenticatedContext(nonExistentSelfRefUid).firestore();
  try {
    await assertSucceeds(getDoc(doc(nonExistentSelfDb, 'referrals', nonExistentSelfRefUid)));
    console.log('[PASS] Worker reading non-existent referral document for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker reading non-existent referral document for self failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST O: Worker reading referral document of unrelated worker fails:');
  try {
    await assertFails(getDoc(doc(newWorkerDb, 'referrals', otherWorkerUid)));
    console.log('[PASS] Worker reading referral document of unrelated worker correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker reading referral document of unrelated worker was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('TEST P: Worker querying emailSubmissions where workerId == self succeeds:');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'emailSubmissions'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query emailSubmissions for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query emailSubmissions for self failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST Q: Worker querying withdrawals where workerId == self succeeds:');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'withdrawals'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query withdrawals for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query withdrawals for self failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST R: Worker querying referrals where referrerId == self succeeds:');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'referrals'), where('referrerId', '==', newWorkerUid))));
    console.log('[PASS] Query referrals for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query referrals for self failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST S: Worker querying missionClaims where workerId == self succeeds:');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'missionClaims'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query missionClaims for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query missionClaims for self failed:', err);
    process.exitCode = 1;
  }

  console.log('TEST T: Worker querying rewardLedger where workerId == self succeeds:');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'rewardLedger'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query rewardLedger for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query rewardLedger for self failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST U: Exact Referral Code Claim Scenario (Worker B claims Worker A code) ---');
  const workerAUid = 'worker_A_111';
  const workerBUid = 'worker_B_222';
  const workerCUid = 'worker_C_333';
  const workerDUid = 'worker_D_444';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Worker A owns a valid referral code (has profile)
    await setDoc(doc(db, 'users', workerAUid), {
      uid: workerAUid,
      name: 'Worker A (Inviter)',
      email: 'workera@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    // Worker B has no referredBy initially
    await setDoc(doc(db, 'users', workerBUid), {
      uid: workerBUid,
      name: 'Worker B (Invitee)',
      email: 'workerb@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    // Worker C has empty referredBy string ("")
    await setDoc(doc(db, 'users', workerCUid), {
      uid: workerCUid,
      name: 'Worker C (Empty Ref)',
      email: 'workerc@example.com',
      referredBy: '',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    // Worker D already has referredBy set to workerAUid
    await setDoc(doc(db, 'users', workerDUid), {
      uid: workerDUid,
      name: 'Worker D (Already Linked)',
      email: 'workerd@example.com',
      referredBy: workerAUid,
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
  });

  const workerBDb = testEnv.authenticatedContext(workerBUid).firestore();
  const workerCDb = testEnv.authenticatedContext(workerCUid).firestore();
  const workerDDb = testEnv.authenticatedContext(workerDUid).firestore();

  const { runTransaction } = await import('firebase/firestore');

  console.log('1. Worker B (no referredBy) claims Worker A code:');
  try {
    await assertSucceeds(
      runTransaction(workerBDb, async (tx) => {
        const currentUserRef = doc(workerBDb, 'users', workerBUid);
        const currentUserSnap = await tx.get(currentUserRef);

        const existingRefDocRef = doc(workerBDb, 'referrals', workerBUid);
        const existingRefSnap = await tx.get(existingRefDocRef);

        const referrerUserRef = doc(workerBDb, 'users', workerAUid);
        const referrerUserSnap = await tx.get(referrerUserRef);

        tx.update(currentUserRef, {
          referredBy: workerAUid,
          updatedAt: serverTimestamp(),
        });

        tx.set(existingRefDocRef, {
          id: workerBUid,
          referrerId: workerAUid,
          referrerName: referrerUserSnap.data().name,
          referredWorkerId: workerBUid,
          referredWorkerName: currentUserSnap.data().name,
          currentAccCount: 0,
          rewardAmount: 0,
          status: 'PENDING',
          createdAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Worker B claiming Worker A code succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker B claiming Worker A code failed:', err);
    process.exitCode = 1;
  }

  console.log('2. Worker C (referredBy == "") claims Worker A code:');
  try {
    await assertSucceeds(
      runTransaction(workerCDb, async (tx) => {
        const currentUserRef = doc(workerCDb, 'users', workerCUid);
        const currentUserSnap = await tx.get(currentUserRef);

        const existingRefDocRef = doc(workerCDb, 'referrals', workerCUid);
        const existingRefSnap = await tx.get(existingRefDocRef);

        const referrerUserRef = doc(workerCDb, 'users', workerAUid);
        const referrerUserSnap = await tx.get(referrerUserRef);

        tx.update(currentUserRef, {
          referredBy: workerAUid,
          updatedAt: serverTimestamp(),
        });

        tx.set(existingRefDocRef, {
          id: workerCUid,
          referrerId: workerAUid,
          referrerName: referrerUserSnap.data().name,
          referredWorkerId: workerCUid,
          referredWorkerName: currentUserSnap.data().name,
          currentAccCount: 0,
          rewardAmount: 0,
          status: 'PENDING',
          createdAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Worker C (empty referredBy) claiming Worker A code succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker C (empty referredBy) claiming Worker A code failed:', err);
    process.exitCode = 1;
  }

  console.log('3. Worker B attempting to claim another code afterward (referredBy immutability):');
  try {
    await assertFails(
      runTransaction(workerBDb, async (tx) => {
        const currentUserRef = doc(workerBDb, 'users', workerBUid);
        tx.update(currentUserRef, {
          referredBy: workerCUid,
          updatedAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Worker B attempting to change referredBy after set correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker B attempting to change referredBy after set was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('4. Worker B attempting to modify Worker A profile:');
  try {
    await assertFails(
      updateDoc(doc(workerBDb, 'users', workerAUid), {
        name: 'Hacked Worker A',
      })
    );
    console.log('[PASS] Worker B attempting to modify Worker A correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker B attempting to modify Worker A was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('5. Self-referral attempt (Worker B claims Worker B code):');
  try {
    await assertFails(
      runTransaction(workerBDb, async (tx) => {
        const existingRefDocRef = doc(workerBDb, 'referrals', 'self_ref_test');
        tx.set(existingRefDocRef, {
          id: 'self_ref_test',
          referrerId: workerBUid,
          referrerName: 'Worker B',
          referredWorkerId: workerBUid,
          referredWorkerName: 'Worker B',
          currentAccCount: 0,
          rewardAmount: 0,
          status: 'PENDING',
          createdAt: serverTimestamp(),
        });
      })
    );
    console.log('[PASS] Self-referral in referrals collection correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Self-referral was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST V: Race Condition / Partial Update Immutability Check (Update without referredBy key) ---');
  const workerVUid = 'worker_V_555';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', workerVUid), {
      uid: workerVUid,
      name: 'Worker V',
      email: 'workerv@example.com',
      referredBy: 'REFERRER_AAA',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
  });

  const workerVDb = testEnv.authenticatedContext(workerVUid).firestore();

  try {
    await assertSucceeds(
      setDoc(doc(workerVDb, 'users', workerVUid), {
        uid: workerVUid,
        name: 'Worker V Updated Name',
        email: 'workerv@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] TEST V: Updating user profile without referredBy key succeeded without CEL Property undefined runtime error.');
  } catch (err) {
    console.error('[FAIL] TEST V: Updating user profile without referredBy key failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST W: Referral Claim Security Rules (referralClaims, rewardLedger, referrals, user balance) ---');
  const claimWorkerUid = 'claim_worker_w1';
  const claimRefId = 'referral_doc_w1';
  const claimDocId = `${claimRefId}_tier_5`;

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', claimWorkerUid), {
      uid: claimWorkerUid,
      name: 'Claim Worker W1',
      email: 'claimw1@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'referrals', claimRefId), {
      id: claimRefId,
      referrerId: claimWorkerUid,
      referredWorkerId: 'child_worker_1',
      referredWorkerName: 'Child Worker 1',
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
      createdAt: new Date(),
    });
  });

  const claimWorkerDb = testEnv.authenticatedContext(claimWorkerUid).firestore();

  console.log('1. Worker checking non-existent claim request (resource == null):');
  try {
    await assertSucceeds(getDoc(doc(claimWorkerDb, 'referralClaims', claimDocId)));
    console.log('[PASS] Worker get non-existent referralClaim succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker get non-existent referralClaim failed:', err);
    process.exitCode = 1;
  }

  console.log('2. Worker creating valid pending claim request (status == "pending"):');
  try {
    await assertSucceeds(
      setDoc(doc(claimWorkerDb, 'referralClaims', claimDocId), {
        id: claimDocId,
        referralId: claimRefId,
        referrerId: claimWorkerUid,
        referredWorkerId: 'child_worker_1',
        minAcc: 5,
        rewardAmount: 500,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker creating pending referral claim succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker creating pending referral claim failed:', err);
    process.exitCode = 1;
  }

  console.log('3. Worker attempting to create claim as "approved":');
  try {
    await assertFails(
      setDoc(doc(claimWorkerDb, 'referralClaims', `${claimRefId}_tier_10`), {
        id: `${claimRefId}_tier_10`,
        referralId: claimRefId,
        referrerId: claimWorkerUid,
        referredWorkerId: 'child_worker_1',
        minAcc: 10,
        rewardAmount: 1000,
        status: 'approved',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker creating approved referral claim correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker creating approved referral claim was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('4. Worker attempting to update referralClaim to "approved":');
  try {
    await assertFails(
      updateDoc(doc(claimWorkerDb, 'referralClaims', claimDocId), {
        status: 'approved',
      })
    );
    console.log('[PASS] Worker updating referralClaim status correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker updating referralClaim status was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('5. Worker attempting direct write to rewardLedger:');
  try {
    await assertFails(
      setDoc(doc(claimWorkerDb, 'rewardLedger', 'illegal_ledger_entry'), {
        workerId: claimWorkerUid,
        rewardType: 'referral',
        amount: 5000,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker writing to rewardLedger correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker writing to rewardLedger was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('6. Worker attempting direct update to referrals collection (claimedTiers/rewardAmount):');
  try {
    await assertFails(
      updateDoc(doc(claimWorkerDb, 'referrals', claimRefId), {
        claimedTiers: { '5': true },
        rewardAmount: 500,
      })
    );
    console.log('[PASS] Worker updating referrals document correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker updating referrals document was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('7. Worker attempting balance increase on users/{uid}:');
  try {
    await assertFails(
      updateDoc(doc(claimWorkerDb, 'users', claimWorkerUid), {
        balance: 500,
      })
    );
    console.log('[PASS] Worker increasing balance on users/{uid} correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker increasing balance on users/{uid} was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('8. Worker attempting to claim another worker\'s referralClaim request:');
  const fakeClaimDb = testEnv.authenticatedContext('hacker_uid').firestore();
  try {
    await assertFails(
      setDoc(doc(fakeClaimDb, 'referralClaims', `${claimRefId}_tier_20`), {
        id: `${claimRefId}_tier_20`,
        referralId: claimRefId,
        referrerId: claimWorkerUid, // Spoofed referrer
        referredWorkerId: 'child_worker_1',
        minAcc: 20,
        rewardAmount: 2000,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Worker creating claim request for another worker correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker creating claim request for another worker was not rejected:', err);
    process.exitCode = 1;
  }

  await testEnv.cleanup();
  console.log('\nAll regression tests completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
