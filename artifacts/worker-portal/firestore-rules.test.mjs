import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const PROJECT_ID = 'creat-2c127';
const rulesContent = fs.readFileSync(path.resolve('../firestore.rules'), 'utf8');

const adminUid = 'vQfEbhhVyXMXVlhYmu4AgOvmony1';
const workerUid = 'worker_test_user_123';

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
    // Admin user doc with casing "Admin"
    await setDoc(doc(db, 'users', adminUid), {
      uid: adminUid,
      name: 'Admin User',
      email: 'mandarawanzz@gmail.com',
      role: 'Admin',
      status: 'approved',
    });
    // Worker user doc
    await setDoc(doc(db, 'users', workerUid), {
      uid: workerUid,
      name: 'Worker User',
      email: 'worker@example.com',
      role: 'worker',
      status: 'approved',
    });
  });

  console.log('\n--- TEST A: Authenticated Admin UID write settings/rules ---');
  const adminDb = testEnv.authenticatedContext(adminUid).firestore();
  try {
    await assertSucceeds(
      setDoc(
        doc(adminDb, 'settings', 'rules'),
        { pricePerEmail: 5000, minWithdraw: 50000, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );
    console.log('[PASS] Admin UID write settings/rules succeeded.');
  } catch (err) {
    console.error('[FAIL] Admin UID write settings/rules failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST B: Authenticated Worker UID write settings/rules (should fail) ---');
  const workerDb = testEnv.authenticatedContext(workerUid).firestore();
  try {
    await assertFails(
      setDoc(
        doc(workerDb, 'settings', 'rules'),
        { pricePerEmail: 99999, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );
    console.log('[PASS] Worker UID write settings/rules correctly rejected with permission-denied.');
  } catch (err) {
    console.error('[FAIL] Worker UID write settings/rules was not rejected properly:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST C: Unauthenticated user write settings/rules (should fail) ---');
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  try {
    await assertFails(
      setDoc(
        doc(unauthDb, 'settings', 'rules'),
        { pricePerEmail: 99999, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );
    console.log('[PASS] Unauthenticated user write settings/rules correctly rejected with permission-denied.');
  } catch (err) {
    console.error('[FAIL] Unauthenticated user write settings/rules was not rejected properly:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST D: Worker can read own users/{uid} document ---');
  try {
    await assertSucceeds(getDoc(doc(workerDb, 'users', workerUid)));
    console.log('[PASS] Worker read own profile succeeded.');
  } catch (err) {
    console.error('[FAIL] Worker read own profile failed:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST E: Worker cannot read another worker profile document (should fail) ---');
  const otherWorkerUid = 'other_worker_456';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', otherWorkerUid), {
      uid: otherWorkerUid,
      name: 'Other Worker',
      email: 'other@example.com',
      role: 'worker',
      status: 'active',
    });
  });
  try {
    await assertFails(getDoc(doc(workerDb, 'users', otherWorkerUid)));
    console.log('[PASS] Worker reading another worker profile correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker reading another worker profile was not rejected:', err);
    process.exitCode = 1;
  }

  console.log('\n--- TEST F: Worker cannot modify role, tier, or increase balance (should fail) ---');
  try {
    await assertFails(
      setDoc(doc(workerDb, 'users', workerUid), {
        uid: workerUid,
        name: 'Worker User',
        email: 'worker@example.com',
        role: 'admin', // disallowed
        status: 'approved',
      })
    );
    console.log('[PASS] Worker role elevation correctly rejected.');
  } catch (err) {
    console.error('[FAIL] Worker role elevation was not rejected:', err);
    process.exitCode = 1;
  }

  await testEnv.cleanup();
  console.log('\nAll regression tests completed.');
}

main().catch((err) => {
  console.error('Fatal error in regression test suite:', err);
  process.exit(1);
});
