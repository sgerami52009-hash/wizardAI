const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'avatar', 'resource-monitor.ts');
console.log('Checking file:', filePath);
console.log('File exists:', fs.existsSync(filePath));

if (fs.existsSync(filePath)) {
  const stats = fs.statSync(filePath);
  console.log('File size:', stats.size, 'bytes');
  
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('Content length:', content.length);
  console.log('First 200 characters:');
  console.log(content.substring(0, 200));
  
  console.log('\nSearching for key patterns:');
  console.log('- export class ResourceMonitor:', content.includes('export class ResourceMonitor'));
  console.log('- extends EventEmitter:', content.includes('extends EventEmitter'));
  console.log('- interface ResourceMetrics:', content.includes('interface ResourceMetrics'));
}