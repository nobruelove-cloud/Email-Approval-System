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

  console.log('\n--- TEST A: Valid worker self-profile creation succeeds ---');
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
    console.log('[PASS] Valid worker self-profile creation succeeded.');
  } catch (err) {
    console.error('[FAIL] Valid worker self-profile creation failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST B: Worker attempting role: "admin" fails ---');
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
    console.log('[PASS] Worker attempting role: "admin" correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting role: "admin" was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST C: Worker attempting tier > 1 fails ---');
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
    console.log('[PASS] Worker attempting tier > 1 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting tier > 1 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST D: Worker attempting balance > 0 fails ---');
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
    console.log('[PASS] Worker attempting balance > 0 correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting balance > 0 was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST E: Worker attempting to create uid != request.auth.uid fails ---');
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
    console.log('[PASS] Worker attempting create for another UID correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker attempting create for another UID was not rejected:', err);
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


  await testEnv.cleanup();
  console.log('\nAll regression tests completed.');
}

main().catch((err) => {
  console.error('Fatal error in regression test suite:', err);
  process.exit(1);
});
