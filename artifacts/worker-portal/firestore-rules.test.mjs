import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const PROJECT_ID = 'creat-2c127';
const rulesContent = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../firestore.rules'), 'utf8');

const adminUid = 'vQfEbhhVyXMXVlhYmu4AgOvmony1';
const workerUid = 'worker_test_user_123';
const newWorkerUid = 'new_worker_456';
const otherWorkerUid = 'other_worker_789';

async function main() {
  console.log('Initializing Firestore rules regression test suite...');
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

  console.log('\n--- CASE A: Existing worker login without referral (Self-read profile) ---');
  const existingWorkerDbForRead = testEnv.authenticatedContext(workerUid).firestore();
  try {
    await assertSucceeds(getDoc(doc(existingWorkerDbForRead, 'users', workerUid)));
    console.log('[PASS] Case A: Existing worker reading own profile succeeded.');
  } catch (err) {
    console.error('[FAIL] Case A: Existing worker reading own profile failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- CASE B: New worker registration without referral ---');
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
    console.log('[PASS] Case B: New worker registration with status "active" succeeded.');
  } catch (err) {
    console.error('[FAIL] Case B: New worker registration with status "active" failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- CASE C: New worker registration with valid referral ---');
  const refWorkerUid = 'ref_worker_789';
  const refWorkerDb = testEnv.authenticatedContext(refWorkerUid).firestore();
  try {
    await assertSucceeds(
      setDoc(doc(refWorkerDb, 'users', refWorkerUid), {
        uid: refWorkerUid,
        name: 'Referred Worker',
        email: 'referredworker@example.com',
        phone: '08123456789',
        referredBy: workerUid,
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Case C: New worker registration with referredBy string succeeded.');
  } catch (err) {
    console.error('[FAIL] Case C: New worker registration with referredBy string failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 1: Different UID creation fails ---');
  try {
    await assertFails(
      setDoc(doc(newWorkerDb, 'users', otherWorkerUid), {
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
    console.log('[PASS] Negative Case: Different UID creation correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Different UID creation was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 2: Role "admin" fails ---');
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
    console.log('[PASS] Negative Case: Role "admin" correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Role "admin" was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 3: Status "pending" fails ---');
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
    console.log('[PASS] Negative Case: Status "pending" correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Status "pending" was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 4: Tier 5 fails ---');
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
    console.log('[PASS] Negative Case: Tier 5 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Tier 5 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 5: Balance > 0 fails ---');
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
    console.log('[PASS] Negative Case: Balance > 0 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Balance > 0 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 6: Arbitrary extra field fails ---');
  const extraFieldUid = 'extra_field_user';
  const extraFieldDb = testEnv.authenticatedContext(extraFieldUid).firestore();
  try {
    await assertFails(
      setDoc(doc(extraFieldDb, 'users', extraFieldUid), {
        uid: extraFieldUid,
        name: 'Extra Field User',
        email: 'extrafield@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
        arbitraryField: 'hacked_value',
      })
    );
    console.log('[PASS] Negative Case: Arbitrary extra field correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Arbitrary extra field was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 7: Invalid phone type (number instead of string) fails ---');
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
    console.log('[PASS] Negative Case: Invalid phone type correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Invalid phone type was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 8: Invalid referredBy type (array instead of string) fails ---');
  const badRefUid = 'bad_ref_user';
  const badRefDb = testEnv.authenticatedContext(badRefUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badRefDb, 'users', badRefUid), {
        uid: badRefUid,
        name: 'Bad Ref User',
        email: 'badref@example.com',
        referredBy: ['ref1', 'ref2'],
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: serverTimestamp(),
      })
    );
    console.log('[PASS] Negative Case: Invalid referredBy type correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Invalid referredBy type was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- NEGATIVE CASE 9: Invalid createdAt (string instead of timestamp) fails ---');
  const badCreatedUid = 'bad_created_user';
  const badCreatedDb = testEnv.authenticatedContext(badCreatedUid).firestore();
  try {
    await assertFails(
      setDoc(doc(badCreatedDb, 'users', badCreatedUid), {
        uid: badCreatedUid,
        name: 'Bad Created User',
        email: 'badcreated@example.com',
        role: 'worker',
        status: 'active',
        tier: 1,
        balance: 0,
        createdAt: '2026-08-24T00:00:00Z',
      })
    );
    console.log('[PASS] Negative Case: Invalid createdAt correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Negative Case: Invalid createdAt was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST F: Worker attempting to overwrite an existing profile with role escalation, tier escalation, or balance increase fails ---');
  const existingWorkerDb = testEnv.authenticatedContext(workerUid).firestore();
  try {
    await assertFails(
      setDoc(doc(existingWorkerDb, 'users', workerUid), {
        uid: workerUid,
        name: 'Worker User Escalated',
        email: 'worker@example.com',
        role: 'admin',
        status: 'active',
        tier: 3,
        balance: 999999,
        createdAt: new Date(),
      })
    );
    console.log('[PASS] Worker overwriting existing profile with role/tier/balance escalation correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker overwriting existing profile escalation was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST G: Existing profile is not overwritten by automatic recovery ---');
  // Attempting setDoc with recovery default payload (tier 1, balance 0) on existing profile (tier 2, balance 15000)
  try {
    await assertFails(
      setDoc(doc(existingWorkerDb, 'users', workerUid), {
        uid: workerUid,
        name: 'Worker User',
        email: 'worker@example.com',
        role: 'worker',
        status: 'active',
        tier: 1, // trying to overwrite tier 2 to tier 1
        balance: 0, // trying to overwrite balance 15000 to 0
        createdAt: new Date(),
      })
    );
    console.log('[PASS] Worker attempt to overwrite existing profile with default recovery values correctly rejected by update rules.');
  } catch (err) {
    console.error('[FAIL] Worker overwrite of existing profile was not rejected:', err);
    process.exitCode = 1;
  }

  // Verify profile balance & tier remain unchanged
  let data;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), 'users', workerUid));
    data = snap.data();
  });
  if (data?.tier === 2 && data?.balance === 15000 && data?.role === 'worker') {
    console.log('[PASS] Verified existing profile data was protected and preserved intact.');
  } else {
    console.error('[FAIL] Existing profile data was corrupted or altered:', data);
    process.exitCode = 1;
  }

  console.log('\n--- TEST H: Worker missionClaim creation ---');
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

  console.log('\n--- TEST I: Worker attempting status: "approved" in missionClaim fails ---');
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

  console.log('\n--- TEST J: Worker financialTransactions access (read & write) fails ---');
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

  console.log('\n--- TEST K: Admin financialTransactions access (read & write) succeeds ---');
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

  console.log('\n--- TEST L: Worker creating valid referral relationship for themselves succeeds ---');
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

  console.log('\n--- TEST M: Worker attempting create referral for another worker fails ---');
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

  console.log('\n--- TEST N: Worker reading non-existent referral document for themselves succeeds ---');
  const nonExistentSelfRefUid = 'unregistered_ref_worker_123';
  const nonExistentSelfDb = testEnv.authenticatedContext(nonExistentSelfRefUid).firestore();
  try {
    await assertSucceeds(getDoc(doc(nonExistentSelfDb, 'referrals', nonExistentSelfRefUid)));
    console.log('[PASS] Worker reading non-existent referral document for themselves succeeded (no permission-denied).');
  } catch (err) {
    console.error('[FAIL] Worker reading non-existent referral document for themselves failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST O: Worker reading referral document of an unrelated worker fails ---');
  try {
    await assertFails(getDoc(doc(newWorkerDb, 'referrals', otherWorkerUid)));
    console.log('[PASS] Worker reading referral document of an unrelated worker correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker reading referral document of an unrelated worker was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST P: Worker querying emailSubmissions where workerId == self succeeds ---');
  const { getDocs, query, collection, where } = await import('firebase/firestore');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'emailSubmissions'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query emailSubmissions for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query emailSubmissions for self failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST Q: Worker querying withdrawals where workerId == self succeeds ---');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'withdrawals'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query withdrawals for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query withdrawals for self failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST R: Worker querying referrals where referrerId == self succeeds ---');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'referrals'), where('referrerId', '==', newWorkerUid))));
    console.log('[PASS] Query referrals for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query referrals for self failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST S: Worker querying missionClaims where workerId == self succeeds ---');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'missionClaims'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query missionClaims for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query missionClaims for self failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST T: Worker querying rewardLedger where workerId == self succeeds ---');
  try {
    await assertSucceeds(getDocs(query(collection(newWorkerDb, 'rewardLedger'), where('workerId', '==', newWorkerUid))));
    console.log('[PASS] Query rewardLedger for self succeeded.');
  } catch (err) {
    console.error('[FAIL] Query rewardLedger for self failed:', err);
    process.exitCode = 1;
  }

  await testEnv.cleanup();
  console.log('\nAll regression tests completed.');
}

main().catch((err) => {
  console.error('Fatal error in regression test suite:', err);
  process.exit(1);
});
