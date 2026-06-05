import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentMediaLibrary } from '@/lib/db/schema';
import { uploadFileToS3, deleteFileFromS3 } from '@/lib/s3';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(req.url);
        const nodeId = searchParams.get('nodeId');

        if (!nodeId) {
            return NextResponse.json({ error: 'nodeId é obrigatório' }, { status: 400 });
        }

        const files = await db
            .select()
            .from(agentMediaLibrary)
            .where(
                and(
                    eq(agentMediaLibrary.organizationId, companyId),
                    eq(agentMediaLibrary.nodeId, nodeId)
                )
            )
            .orderBy(agentMediaLibrary.createdAt);

        const mappedFiles = files.map(f => ({
            id: f.id,
            file_name: f.fileName,
            file_url: f.fileUrl,
            file_type: f.fileType,
            file_size: f.fileSize,
            description: f.description,
            created_at: f.createdAt,
        }));

        return NextResponse.json({ files: mappedFiles });
    } catch (err: any) {
        console.error('[agent-library GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const nodeId = formData.get('nodeId') as string;
        const ruleId = formData.get('ruleId') as string | null;
        const description = formData.get('description') as string | null;

        if (!file || !nodeId) {
            return NextResponse.json({ error: 'file e nodeId são obrigatórios' }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: `Tipo não suportado: ${file.type}` }, { status: 400 });
        }

        const fileType = getFileType(file.type);
        const ext = file.name.split('.').pop() || 'bin';
        const fileId = uuidv4();
        const storagePath = `agent-library/${nodeId}/${fileId}.${ext}`;

        // Upload via the project's unified storage layer (S3/Neon/Local)
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const fileUrl = await uploadFileToS3(companyId, storagePath, fileBuffer, file.type);

        // Persist metadata to Postgres
        const [row] = await db
            .insert(agentMediaLibrary)
            .values({
                organizationId: companyId,
                nodeId,
                ruleId: ruleId || null,
                fileName: file.name,
                fileUrl,
                fileType,
                fileSize: file.size,
                description: description || null,
                storagePath,
            })
            .returning();

        const mappedRow = {
            id: row.id,
            file_name: row.fileName,
            file_url: row.fileUrl,
            file_type: row.fileType,
            file_size: row.fileSize,
            description: row.description,
            created_at: row.createdAt,
        };

        return NextResponse.json({ file: mappedRow }, { status: 201 });
    } catch (err: any) {
        console.error('[agent-library POST]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

        // Fetch to verify ownership and get storage path
        const [row] = await db
            .select()
            .from(agentMediaLibrary)
            .where(
                and(
                    eq(agentMediaLibrary.id, id),
                    eq(agentMediaLibrary.organizationId, companyId)
                )
            );

        if (!row) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });

        // Delete from storage
        if (row.storagePath) {
            await deleteFileFromS3(companyId, row.storagePath).catch(err => {
                console.warn('[agent-library DELETE] storage delete failed (non-fatal):', err.message);
            });
        }

        // Delete from DB
        await db.delete(agentMediaLibrary).where(eq(agentMediaLibrary.id, id));

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[agent-library DELETE]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await req.json();
        const { id, description } = body;

        if (!id) {
            return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
        }

        const [row] = await db
            .update(agentMediaLibrary)
            .set({ description: description || null })
            .where(
                and(
                    eq(agentMediaLibrary.id, id),
                    eq(agentMediaLibrary.organizationId, companyId)
                )
            )
            .returning();

        if (!row) {
            return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
        }

        const mappedRow = {
            id: row.id,
            file_name: row.fileName,
            file_url: row.fileUrl,
            file_type: row.fileType,
            file_size: row.fileSize,
            description: row.description,
            created_at: row.createdAt,
        };

        return NextResponse.json({ file: mappedRow });
    } catch (err: any) {
        console.error('[agent-library PATCH]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
