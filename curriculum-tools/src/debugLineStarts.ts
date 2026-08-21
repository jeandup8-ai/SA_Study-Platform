import { readFile } from 'node:fs/promises'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

function groupIntoLines(items: {str:string,x:number,y:number}[]) {
  const sorted = [...items].sort((a,b)=>b.y-a.y || a.x-b.x)
  const lines: typeof items[] = []
  for (const item of sorted) {
    const cur = lines[lines.length-1]
    if (cur && Math.abs(cur[0].y - item.y) <= 2) cur.push(item)
    else lines.push([item])
  }
  return lines.map(l => ({y: l[0].y, x: Math.min(...l.map(i=>i.x))}))
}

async function main() {
  const file = process.argv[2]
  const pageNum = Number(process.argv[3])
  const belowY = Number(process.argv[4] ?? Infinity)
  const data = new Uint8Array(await readFile(file))
  const doc = await pdfjs.getDocument({data}).promise
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()
  interface T {str:string, transform:number[], width:number}
  const items = (content.items as unknown as T[]).filter(i=>i.str.trim().length>0).map(i=>({str:i.str,x:i.transform[4],y:i.transform[5]}))
  const lines = groupIntoLines(items.filter(i=>i.y<belowY)).sort((a,b)=>a.x-b.x)
  const xs = lines.map(l=>l.x)
  console.log('sorted line-start x values:')
  console.log(xs.map(x=>x.toFixed(1)).join(', '))
  console.log('\ngaps:')
  for (let i=1;i<xs.length;i++) {
    const gap = xs[i]-xs[i-1]
    if (gap > 5) console.log(`  ${xs[i-1].toFixed(1)} -> ${xs[i].toFixed(1)}  gap=${gap.toFixed(1)}`)
  }
}
main()
