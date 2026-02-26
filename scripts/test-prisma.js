const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.taxonomy.count().then(c => {
  console.log('Taxonomy count:', c);
  return p.position.count();
}).then(c => {
  console.log('Position count:', c);
  p.$disconnect();
}).catch(e => {
  console.error('Error:', e.message);
  p.$disconnect();
});
