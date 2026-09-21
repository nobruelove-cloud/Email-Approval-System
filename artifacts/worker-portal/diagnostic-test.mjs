import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  collection,
  where,
  runTransaction,
} from 'firebase/firestore';

const PROJECT_ID = 'creat-2c127';
const rulesContent = fs.readFileSync(
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../firestore.rules'),
  'utf8'
);

const adminUid = 'admin_user_uid_123';
const workerAUid = 'worker_A_referrer_uid';
const workerBUid = 'worker_B_referred_uid';

async function main() {
  console.log('--- STARTING FIRESTORE SECURITY RULES DIAGNOSTIC TEST ---');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  await testEnv.clearFirestore();

  // Setup database state without rules
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // 1. Setup Admin profile
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

    // 2. Setup Worker A (Referrer) profile
    await setDoc(doc(db, 'users', workerAUid), {
      uid: workerAUid,
      name: 'Worker A Referrer',
      email: 'workera@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });

    // 3. Setup Worker B (Referred) profile
    await setDoc(doc(db, 'users', workerBUid), {
      uid: workerBUid,
      name: 'Worker B Referred',
      email: 'workerb@example.com',
      referredBy: workerAUid,
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });

    // 4. Setup Referral document (referrals/workerBUid)
    await setDoc(doc(db, 'referrals', workerBUid), {
      id: workerBUid,
      referrerId: workerAUid,
      referrerName: 'Worker A Referrer',
      referredWorkerId: workerBUid,
      referredWorkerName: 'Worker B Referred',
      currentAccCount: 5,
      rewardAmount: 0,
      status: 'QUALIFIED',
      createdAt: new Date(),
    });

    // 5. Setup Rules settings document
    await setDoc(doc(db, 'settings', 'rules'), {
      referralMinAcc: 5,
      referralTiers: [
        { minAcc: 5, reward: 5000 },
        { minAcc: 10, reward: 12000 },
      ],
    });
  });

  const workerADb = testEnv.authenticatedContext(workerAUid).firestore();
  const workerBDb = testEnv.authenticatedContext(workerBUid).firestore();
  const adminDb = testEnv.authenticatedContext(adminUid).firestore();

  console.log('\n=== SECTION 1: WORKER DASHBOARD & WORKER CLAIM FLOW AUDIT ===');

  console.log('1.1 Worker A (Referrer) queries referrals where referrerId == workerAUid (useWorkerEngagementData)');
  try {
    await assertSucceeds(
      getDocs(query(collection(workerADb, 'referrals'), where('referrerId', '==', workerAUid)))
    );
    console.log('[SUCCESS] 1.1 Worker list referrals where referrerId == self');
  } catch (err) {
    console.error('[DENIED] 1.1 Worker list referrals failed:', err);
  }

  console.log('1.2 Worker A (Referrer) queries referralClaims where referrerId == workerAUid (useWorkerEngagementData)');
  try {
    await assertSucceeds(
      getDocs(query(collection(workerADb, 'referralClaims'), where('referrerId', '==', workerAUid)))
    );
    console.log('[SUCCESS] 1.2 Worker list referralClaims where referrerId == self');
  } catch (err) {
    console.error('[DENIED] 1.2 Worker list referralClaims failed:', err);
  }

  console.log('1.3 Worker A (Referrer) executes createReferralClaimRequest for tier 5 ACC (claimDocId: workerBUid_tier_5)');
  const claimDocId = `${workerBUid}_tier_5`;

  // Step 1: getDoc referrals/workerBUid
  try {
    await assertSucceeds(getDoc(doc(workerADb, 'referrals', workerBUid)));
    console.log('[SUCCESS] 1.3a Worker getDoc referrals/workerBUid');
  } catch (err) {
    console.error('[DENIED] 1.3a Worker getDoc referrals/workerBUid failed:', err);
  }

  // Step 2: getDoc settings/rules
  try {
    await assertSucceeds(getDoc(doc(workerADb, 'settings', 'rules')));
    console.log('[SUCCESS] 1.3b Worker getDoc settings/rules');
  } catch (err) {
    console.error('[DENIED] 1.3b Worker getDoc settings/rules failed:', err);
  }

  // Step 3: getDoc referralClaims/workerBUid_tier_5 (non-existent doc)
  try {
    await assertSucceeds(getDoc(doc(workerADb, 'referralClaims', claimDocId)));
    console.log('[SUCCESS] 1.3c Worker getDoc non-existent referralClaims/workerBUid_tier_5');
  } catch (err) {
    console.error('[DENIED] 1.3c Worker getDoc non-existent referralClaims/workerBUid_tier_5 failed:', err);
  }

  // Step 4: setDoc referralClaims/workerBUid_tier_5 (create)
  try {
    await assertSucceeds(
      setDoc(doc(workerADb, 'referralClaims', claimDocId), {
        id: claimDocId,
        referralId: workerBUid,
        referrerId: workerAUid,
        referredWorkerId: workerBUid,
        minAcc: 5,
        rewardAmount: 5000,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[SUCCESS] 1.3d Worker setDoc (create) referralClaims/workerBUid_tier_5');
  } catch (err) {
    console.error('[DENIED] 1.3d Worker setDoc (create) referralClaims/workerBUid_tier_5 failed:', err);
  }

  console.log('1.4 Worker A executes createReferralClaimRequest AGAIN on existing claim doc (setDoc update test)');
  try {
    await assertFails(
      setDoc(doc(workerADb, 'referralClaims', claimDocId), {
        id: claimDocId,
        referralId: workerBUid,
        referrerId: workerAUid,
        referredWorkerId: workerBUid,
        minAcc: 5,
        rewardAmount: 5000,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    );
    console.log('[EXPECTED DENIAL] 1.4 Worker setDoc on EXISTING referralClaims doc rejected because it evaluates update rule.');
  } catch (err) {
    console.error('[UNEXPECTED] 1.4 Worker setDoc on existing doc succeeded or threw unexpected error:', err);
  }

  console.log('\n=== SECTION 2: ADMIN DASHBOARD & ADMIN APPROVAL FLOW AUDIT ===');

  console.log('2.1 Admin Dashboard initial data load (useAdminData queries)');

  // 2.1a list users
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'users')));
    console.log('[SUCCESS] 2.1a Admin list users');
  } catch (err) {
    console.error('[DENIED] 2.1a Admin list users failed:', err);
  }

  // 2.1b list emailSubmissions
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'emailSubmissions')));
    console.log('[SUCCESS] 2.1b Admin list emailSubmissions');
  } catch (err) {
    console.error('[DENIED] 2.1b Admin list emailSubmissions failed:', err);
  }

  // 2.1c list withdrawals
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'withdrawals')));
    console.log('[SUCCESS] 2.1c Admin list withdrawals');
  } catch (err) {
    console.error('[DENIED] 2.1c Admin list withdrawals failed:', err);
  }

  // 2.1d list referrals
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'referrals')));
    console.log('[SUCCESS] 2.1d Admin list referrals');
  } catch (err) {
    console.error('[DENIED] 2.1d Admin list referrals failed:', err);
  }

  // 2.1e list rewardLedger
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'rewardLedger')));
    console.log('[SUCCESS] 2.1e Admin list rewardLedger');
  } catch (err) {
    console.error('[DENIED] 2.1e Admin list rewardLedger failed:', err);
  }

  // 2.1f list missionClaims
  try {
    await assertSucceeds(getDocs(collection(adminDb, 'missionClaims')));
    console.log('[SUCCESS] 2.1f Admin list missionClaims');
  } catch (err) {
    console.error('[DENIED] 2.1f Admin list missionClaims failed:', err);
  }

  console.log('2.2 Admin executes approveReferral transaction');
  try {
    await assertSucceeds(
      runTransaction(adminDb, async (tx) => {
        const referralRef = doc(adminDb, 'referrals', workerBUid);
        const referralSnap = await tx.get(referralRef);

        const rulesRef = doc(adminDb, 'settings', 'rules');
        const rulesSnap = await tx.get(rulesRef);

        const referrerRef = doc(adminDb, 'users', workerAUid);
        const referrerSnap = await tx.get(referrerRef);

        tx.update(referralRef, {
          claimedTiers: { '5': true },
          rewardAmount: 5000,
          status: 'QUALIFIED',
          rewardedAt: serverTimestamp(),
        });

        tx.update(referrerRef, {
          balance: 5000,
        });

        const ledgerRef = doc(collection(adminDb, 'rewardLedger'));
        tx.set(ledgerRef, {
          workerId: workerAUid,
          workerName: 'Worker A Referrer',
          rewardType: 'referral',
          amount: 5000,
          sourceRefId: `${workerBUid}_tier_5`,
          description: 'Hadiah Referral Tier 5 ACC',
          createdAt: serverTimestamp(),
        });

        const claimRef = doc(adminDb, 'referralClaims', claimDocId);
        tx.set(claimRef, {
          id: claimDocId,
          referralId: workerBUid,
          referrerId: workerAUid,
          referredWorkerId: workerBUid,
          minAcc: 5,
          rewardAmount: 5000,
          status: 'approved',
          processedAt: serverTimestamp(),
        }, { merge: true });
      })
    );
    console.log('[SUCCESS] 2.2 Admin approveReferral transaction succeeded when users/adminUid has role: "admin"');
  } catch (err) {
    console.error('[DENIED] 2.2 Admin approveReferral transaction failed:', err);
  }

  console.log('\n=== SECTION 3: ADMIN ROLE / PROFILE MISSING AUDIT ===');

  const missingAdminUid = 'admin_missing_doc_uid';
  const missingAdminDb = testEnv.authenticatedContext(missingAdminUid).firestore();

  console.log('3.1 User with NO users/{uid} document attempts Admin approveReferral transaction');
  try {
    await assertFails(
      runTransaction(missingAdminDb, async (tx) => {
        const referralRef = doc(missingAdminDb, 'referrals', workerBUid);
        const referralSnap = await tx.get(referralRef);

        const rulesRef = doc(missingAdminDb, 'settings', 'rules');
        const rulesSnap = await tx.get(rulesRef);

        const referrerRef = doc(missingAdminDb, 'users', workerAUid);
        const referrerSnap = await tx.get(referrerRef);

        tx.update(referralRef, {
          claimedTiers: { '5': true },
          rewardAmount: 5000,
          status: 'QUALIFIED',
          rewardedAt: serverTimestamp(),
        });
      })
    );
    console.log('[EXPECTED DENIAL] 3.1 User without users/{uid} profile rejected by isAdmin().');
  } catch (err) {
    console.error('[UNEXPECTED] 3.1 Failed unexpectedly:', err);
  }

  const workerRoleAdminUid = 'admin_with_worker_role_uid';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', workerRoleAdminUid), {
      uid: workerRoleAdminUid,
      name: 'Fake Admin Worker Role',
      email: 'fakeadmin@example.com',
      role: 'worker',
      status: 'active',
      tier: 1,
      balance: 0,
      createdAt: new Date(),
    });
  });
  const workerRoleAdminDb = testEnv.authenticatedContext(workerRoleAdminUid).firestore();

  console.log('3.2 User with users/{uid}.role == "worker" attempts Admin approveReferral transaction');
  try {
    await assertFails(
      runTransaction(workerRoleAdminDb, async (tx) => {
        const referralRef = doc(workerRoleAdminDb, 'referrals', workerBUid);
        const referralSnap = await tx.get(referralRef);
        tx.update(referralRef, { status: 'QUALIFIED' });
      })
    );
    console.log('[EXPECTED DENIAL] 3.2 User with role "worker" rejected by isAdmin().');
  } catch (err) {
    console.error('[UNEXPECTED] 3.2 Failed unexpectedly:', err);
  }

  await testEnv.cleanup();
  console.log('\n--- DIAGNOSTIC AUDIT FINISHED ---');
}

main().catch((err) => {
  console.error('Fatal error in diagnostic test:', err);
  process.exit(1);
});
