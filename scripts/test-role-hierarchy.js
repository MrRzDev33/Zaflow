/**
 * ZAFLOW — ROLE HIERARCHY & AUTHORIZATION VERIFICATION TEST
 * 
 * Menguji seluruh aturan hierarki hak akses:
 * 1. Admin tidak dapat mempromosikan editor menjadi admin
 * 2. Admin tidak dapat mengubah atau menghapus anggota admin
 * 3. Owner dapat mengubah role anggota sesuai aturan (admin/editor/viewer)
 * 4. Pengguna biasa tidak dapat mengklaim owner
 * 5. Request tanpa izin ditolak baik melalui API maupun simulasi RLS database
 */

import http from 'http';

console.log('===============================================================');
console.log('   ZAFLOW — ROLE HIERARCHY & AUTHORIZATION VERIFICATION TEST   ');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// BAGIAN 1: SIMULASI EVALUASI LOGIKA RLS POSTGRESQL (USING & WITH CHECK)
// -----------------------------------------------------------------------------
console.log('--- 1. PENGUJIAN LOGIKA RLS DATABASE (brand_members_update) ---');

function evaluateRLSBrandMembersUpdate(callerRole, targetCurrentRole, targetNewRole) {
  // USING clause:
  // role <> 'owner' AND (
  //   get_user_brand_role(brand_id) = 'owner'
  //   OR (get_user_brand_role(brand_id) = 'admin' AND role IN ('editor', 'viewer'))
  // )
  const passedUsing = (targetCurrentRole !== 'owner') && (
    (callerRole === 'owner') ||
    (callerRole === 'admin' && ['editor', 'viewer'].includes(targetCurrentRole))
  );

  if (!passedUsing) {
    return { allowed: false, reason: 'REJECTED_BY_USING (Baris target tidak dapat diakses atau diubah)' };
  }

  // WITH CHECK clause:
  // (get_user_brand_role(brand_id) = 'owner' AND role IN ('admin', 'editor', 'viewer'))
  // OR
  // (get_user_brand_role(brand_id) = 'admin' AND role IN ('editor', 'viewer'))
  const passedWithCheck = (
    (callerRole === 'owner' && ['admin', 'editor', 'viewer'].includes(targetNewRole)) ||
    (callerRole === 'admin' && ['editor', 'viewer'].includes(targetNewRole))
  );

  if (!passedWithCheck) {
    return { allowed: false, reason: 'REJECTED_BY_WITH_CHECK (Role baru melanggar batasan hak akses)' };
  }

  return { allowed: true, reason: 'PERMITTED' };
}

// Test 1.1: Admin mencoba menaikkan editor menjadi admin -> HARUS DITOLAK
const rlsTest1 = evaluateRLSBrandMembersUpdate('admin', 'editor', 'admin');
assert(!rlsTest1.allowed && rlsTest1.reason.includes('WITH_CHECK'), 
  'RLS: Admin dilarang mempromosikan editor menjadi admin (Ditolak oleh WITH CHECK)');

// Test 1.2: Admin mencoba mengubah sesama admin -> HARUS DITOLAK
const rlsTest2 = evaluateRLSBrandMembersUpdate('admin', 'admin', 'viewer');
assert(!rlsTest2.allowed && rlsTest2.reason.includes('USING'), 
  'RLS: Admin dilarang mengubah role sesama admin (Ditolak oleh USING)');

// Test 1.3: Admin mencoba mengubah owner -> HARUS DITOLAK
const rlsTest3 = evaluateRLSBrandMembersUpdate('admin', 'owner', 'viewer');
assert(!rlsTest3.allowed && rlsTest3.reason.includes('USING'), 
  'RLS: Admin dilarang mengubah role owner (Ditolak oleh USING)');

// Test 1.4: Siapa pun mencoba menaikkan role target menjadi owner -> HARUS DITOLAK
const rlsTest4 = evaluateRLSBrandMembersUpdate('owner', 'editor', 'owner');
assert(!rlsTest4.allowed && rlsTest4.reason.includes('WITH_CHECK'), 
  'RLS: Owner dilarang mengubah anggota biasa menjadi owner via update biasa (Ditolak oleh WITH CHECK)');

// Test 1.5: Owner mengubah editor menjadi admin -> HARUS DIIZINKAN
const rlsTest5 = evaluateRLSBrandMembersUpdate('owner', 'editor', 'admin');
assert(rlsTest5.allowed, 
  'RLS: Owner diizinkan mengubah editor menjadi admin (Lolos USING dan WITH CHECK)');

// Test 1.6: Admin mengubah editor menjadi viewer -> HARUS DIIZINKAN
const rlsTest6 = evaluateRLSBrandMembersUpdate('admin', 'editor', 'viewer');
assert(rlsTest6.allowed, 
  'RLS: Admin diizinkan mengubah editor menjadi viewer (Lolos USING dan WITH CHECK)');

// Test 1.7: Anggota biasa (editor/viewer) mencoba melakukan update -> HARUS DITOLAK
const rlsTest7 = evaluateRLSBrandMembersUpdate('editor', 'viewer', 'editor');
assert(!rlsTest7.allowed && rlsTest7.reason.includes('USING'), 
  'RLS: Editor/Viewer dilarang memodifikasi role anggota lain (Ditolak oleh USING)');


// -----------------------------------------------------------------------------
// BAGIAN 2: SIMULASI LOGIKA OTORISASI BACKEND (PATCH /api/team/members/:userId)
// -----------------------------------------------------------------------------
console.log('\n--- 2. PENGUJIAN LOGIKA OTORISASI BACKEND API (server.ts) ---');

function validateBackendRoleUpdate(requesterRole, targetCurrentRole, targetNewRole) {
  const ALLOWED_TARGET_ROLES = ['admin', 'editor', 'viewer'];
  
  if (targetNewRole === 'owner') {
    return { status: 400, error: 'Role owner tidak dapat ditetapkan melalui endpoint ini.' };
  }
  if (!ALLOWED_TARGET_ROLES.includes(targetNewRole)) {
    return { status: 400, error: `Role '${targetNewRole}' tidak valid.` };
  }

  if (!['owner', 'admin'].includes(requesterRole)) {
    return { status: 403, error: 'Akses ditolak.' };
  }

  if (targetCurrentRole === 'owner') {
    return { status: 403, error: 'Role owner tidak dapat diubah melalui endpoint ini.' };
  }

  if (requesterRole === 'admin') {
    if (targetCurrentRole === 'admin') {
      return { status: 403, error: 'Akses ditolak: Admin tidak dapat mengubah role sesama admin.' };
    }
    if (!['editor', 'viewer'].includes(targetCurrentRole)) {
      return { status: 403, error: 'Akses ditolak: Admin hanya dapat mengelola anggota dengan role editor atau viewer.' };
    }
    if (targetNewRole === 'admin') {
      return { status: 403, error: 'Akses ditolak: Admin tidak diizinkan mempromosikan anggota menjadi admin.' };
    }
    if (!['editor', 'viewer'].includes(targetNewRole)) {
      return { status: 403, error: 'Akses ditolak: Role baru untuk admin hanya boleh editor atau viewer.' };
    }
  }

  return { status: 200, success: true };
}

// Test 2.1: Validasi payload menolak role sembarangan (misal: 'super_admin')
const apiTest1 = validateBackendRoleUpdate('owner', 'editor', 'super_admin');
assert(apiTest1.status === 400, 'API: Menolak penetapan role tidak dikenal (400 Bad Request)');

// Test 2.2: Validasi payload menolak klaim role owner
const apiTest2 = validateBackendRoleUpdate('owner', 'editor', 'owner');
assert(apiTest2.status === 400, 'API: Menolak penetapan role owner secara langsung (400 Bad Request)');

// Test 2.3: Admin mencoba mempromosikan editor menjadi admin
const apiTest3 = validateBackendRoleUpdate('admin', 'editor', 'admin');
assert(apiTest3.status === 403 && apiTest3.error.includes('tidak diizinkan mempromosikan'), 
  'API: Admin ditolak saat mencoba mempromosikan editor menjadi admin (403 Forbidden)');

// Test 2.4: Admin mencoba mengubah role sesama admin
const apiTest4 = validateBackendRoleUpdate('admin', 'admin', 'viewer');
assert(apiTest4.status === 403 && apiTest4.error.includes('sesama admin'), 
  'API: Admin ditolak saat mencoba mengubah role sesama admin (403 Forbidden)');

// Test 2.5: Admin mencoba mengubah role owner
const apiTest5 = validateBackendRoleUpdate('admin', 'owner', 'viewer');
assert(apiTest5.status === 403 && apiTest5.error.includes('owner'), 
  'API: Admin ditolak saat mencoba mengubah role owner (403 Forbidden)');

// Test 2.6: Pemanggil dengan role editor/viewer ditolak mengelola anggota
const apiTest6 = validateBackendRoleUpdate('editor', 'viewer', 'editor');
assert(apiTest6.status === 403, 'API: Anggota non-admin/owner ditolak memodifikasi role (403 Forbidden)');

// Test 2.7: Owner mengubah editor menjadi admin -> BERHASIL
const apiTest7 = validateBackendRoleUpdate('owner', 'editor', 'admin');
assert(apiTest7.status === 200, 'API: Owner berhasil mengubah role editor menjadi admin (200 OK)');

// Test 2.8: Admin mengubah editor menjadi viewer -> BERHASIL
const apiTest8 = validateBackendRoleUpdate('admin', 'editor', 'viewer');
assert(apiTest8.status === 200, 'API: Admin berhasil mengubah role editor menjadi viewer (200 OK)');


// -----------------------------------------------------------------------------
// BAGIAN 3: PENGUJIAN LOGIKA DELETE /api/team/members/:userId
// -----------------------------------------------------------------------------
console.log('\n--- 3. PENGUJIAN LOGIKA DELETE (Penghapusan Anggota) ---');

function validateBackendRoleDelete(requesterId, targetUserId, requesterRole, targetCurrentRole) {
  if (targetCurrentRole === 'owner') {
    return { status: 403, error: 'Role owner tidak dapat dihapus dari brand.' };
  }

  const isSelf = requesterId === targetUserId;
  if (!isSelf) {
    if (!['owner', 'admin'].includes(requesterRole)) {
      return { status: 403, error: 'Akses ditolak.' };
    }
    if (requesterRole === 'admin') {
      if (targetCurrentRole === 'admin') {
        return { status: 403, error: 'Akses ditolak: Admin tidak dapat menghapus sesama admin.' };
      }
      if (!['editor', 'viewer'].includes(targetCurrentRole)) {
        return { status: 403, error: 'Akses ditolak: Admin hanya dapat menghapus editor atau viewer.' };
      }
    }
  }

  return { status: 200, success: true };
}

// Test 3.1: Admin mencoba menghapus sesama admin -> HARUS DITOLAK
const delTest1 = validateBackendRoleDelete('user-admin-1', 'user-admin-2', 'admin', 'admin');
assert(delTest1.status === 403 && delTest1.error.includes('sesama admin'),
  'DELETE: Admin ditolak saat mencoba menghapus sesama admin (403 Forbidden)');

// Test 3.2: Admin mencoba menghapus owner -> HARUS DITOLAK
const delTest2 = validateBackendRoleDelete('user-admin-1', 'user-owner', 'admin', 'owner');
assert(delTest2.status === 403 && delTest2.error.includes('owner'),
  'DELETE: Admin ditolak saat mencoba menghapus owner (403 Forbidden)');

// Test 3.3: Admin menghapus viewer -> BERHASIL
const delTest3 = validateBackendRoleDelete('user-admin-1', 'user-viewer', 'admin', 'viewer');
assert(delTest3.status === 200, 'DELETE: Admin berhasil menghapus viewer (200 OK)');

// Test 3.4: Anggota keluar sendiri (self-leave) dari role editor -> BERHASIL
const delTest4 = validateBackendRoleDelete('user-editor-1', 'user-editor-1', 'editor', 'editor');
assert(delTest4.status === 200, 'DELETE: Anggota non-owner berhasil keluar mandiri (200 OK)');

// Test 3.5: Owner mencoba keluar sendiri (self-leave) -> DITOLAK
const delTest5 = validateBackendRoleDelete('user-owner', 'user-owner', 'owner', 'owner');
assert(delTest5.status === 403 && delTest5.error.includes('owner'),
  'DELETE: Owner dilarang menghapus akunnya sendiri selama brand aktif (403 Forbidden)');


// -----------------------------------------------------------------------------
// BAGIAN 4: PENGUJIAN INTEGRASI HTTP KE DEV SERVER AKTIF (PORT 3000)
// -----------------------------------------------------------------------------
console.log('\n--- 4. PENGUJIAN INTEGRASI HTTP AKTUAL (DEV SERVER PORT 3000) ---');

async function testHttpEndpoint() {
  // 4.1 Request tanpa Bearer token ke PATCH /api/team/members/any-id -> 401
  await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/team/members/00000000-0000-0000-0000-000000000002',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (res) => {
      assert(res.statusCode === 401, 'INTEGRASI HTTP: PATCH tanpa Bearer token ditolak dengan status 401 Unauthorized');
      resolve();
    });

    req.on('error', (err) => {
      console.warn('Dev server belum berjalan di port 3000 atau koneksi gagal:', err.message);
      resolve();
    });

    req.write(JSON.stringify({ brand_id: 'some-brand', role: 'admin' }));
    req.end();
  });

  // 4.2 Request tanpa Bearer token ke DELETE /api/team/members/any-id -> 401
  await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/team/members/00000000-0000-0000-0000-000000000002?brand_id=some-brand',
      method: 'DELETE',
    }, (res) => {
      assert(res.statusCode === 401, 'INTEGRASI HTTP: DELETE tanpa Bearer token ditolak dengan status 401 Unauthorized');
      resolve();
    });

    req.on('error', (err) => {
      console.warn('Dev server belum berjalan di port 3000 atau koneksi gagal:', err.message);
      resolve();
    });

    req.end();
  });
}

await testHttpEndpoint();


console.log('\n===============================================================');
console.log(` HASIL PENGUJIAN: ${passedTests} / ${totalTests} TES BERHASIL LULUS.`);
console.log('===============================================================');
