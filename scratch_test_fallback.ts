import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { uploadMediaToMeta } from './src/lib/metaMediaUpload';

async function run() {
  try {
    const connectionId = '81994284-e8f0-4a2b-b17b-a9440a0d563a';
    const connection = await db.query.connections.findFirst({
      where: eq(connections.id, connectionId)
    });
    
    const url = "https://scontent.whatsapp.net/v/t61.29466-34/593961062_1655668925686378_3745880973619375483_n.jpg?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=CoyzyVXpucAQ7kNvwHiu9D-&_nc_oc=AdpMwif7YzL9-NFiho0Cr8GkDH8d5BBizi9Zco2sCFCtfU509Nw02vsQjyb3P5rYOdjm8vgPhxFOPKpPFx2cwsHw&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=DPawGxDPogdwyUtYSuSuQA&_nc_tpa=Q5bMBQHQz5xu_iW4GkmVx-UNV0mxJqv_Zk21gEDL-gqSzdSR9C2PIy54-j_6_zAnslUH-nj-zDMijdO4fA&oh=01_Q5Aa4QEsINKEmhlhKgytT2MqXirtG4P_9oP7ktKR-jX4kvdqDQ&oe=6A21B9CF";
    
    console.log("Fetching media from CDN...");
    const mediaRes = await fetch(url);
    if (!mediaRes.ok) throw new Error("Falha HTTP " + mediaRes.status);
    
    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = mediaRes.headers.get('content-type') || 'application/octet-stream';
    
    console.log(`Downloaded ${buffer.length} bytes. Mime: ${mimeType}`);
    
    const accessToken = decrypt(connection!.accessToken!);
    console.log("Uploading to Meta...");
    const handle = await uploadMediaToMeta(
      connection!.phoneNumberId!,
      accessToken,
      buffer,
      mimeType,
      'template_media_legado.jpg'
    );
    console.log("Handle:", handle);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
