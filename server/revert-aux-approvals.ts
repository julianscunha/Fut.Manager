/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Temporary script: reverts users who were approved by auxiliares back to 'pending'.
 * Run with: npx tsx server/revert-aux-approvals.ts
 */

import { readDb, writeDb } from './db';

async function main() {
  const db = await readDb();

  // Find all auxiliares
  const auxNames = db.users
    .filter((u: any) => u.role === 'auxiliar')
    .map((u: any) => u.name);

  if (auxNames.length === 0) {
    console.log('Nenhum auxiliar encontrado.');
    return;
  }
  console.log('Auxiliares:', auxNames.join(', '));

  // Find approval audits performed by auxiliares
  const auxApprovals = (db.userAudits || []).filter((a: any) =>
    a.action.startsWith('Aprovação de Cadastro') && auxNames.includes(a.performedBy)
  );

  if (auxApprovals.length === 0) {
    console.log('Nenhuma aprovação feita por auxiliar encontrada.');
    return;
  }

  console.log(`\nAprovações por auxiliares encontradas: ${auxApprovals.length}`);
  for (const audit of auxApprovals) {
    const user = db.users.find((u: any) => u.id === audit.userId);
    if (user && user.status === 'approved') {
      user.status = 'pending';
      console.log(`  → Revertido: ${audit.userName} (${audit.userEmail}) — aprovado por ${audit.performedBy}`);
    } else {
      console.log(`  → Ignorado: ${audit.userName} (já não está approved)`);
    }
  }

  await writeDb(db);
  console.log('\nBanco atualizado com sucesso.');
}

main().catch(console.error);