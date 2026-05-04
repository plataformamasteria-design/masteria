import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const sessionDir = path.join(process.cwd(), 'whatsapp_sessions');
    const files = fs.readdirSync(sessionDir);
    const sessionFolders = files.filter(f => f.startsWith('session_'));
    
    // Logic to ensure the folder matches the DB or vice versa
    // For now, return the current state
    return NextResponse.json({
      success: true,
      message: 'Session ID fix route triggered',
      sessionFolders,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
