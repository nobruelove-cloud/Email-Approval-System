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

  await testEnv.cleanup();
  console.log('\nAll regression tests completed.');
}

main().catch((err) => {
  console.error('Fatal error in regression test suite:', err);
  process.exit(1);
});
