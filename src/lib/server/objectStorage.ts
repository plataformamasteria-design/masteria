import { Storage, File } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  // projectId: process.env.REPL_ID || "", // ✅ REMOVIDO: Deixar que o Sidecar resolva automaticamente
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {
    this.checkEnvironment();
  }

  // Check if we are in an environment that supports Replit Object Storage
  private checkEnvironment() {
    const onReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT_ID);
    const isWin = process.platform === 'win32';

    if (isWin || !onReplit) {
      console.log(`[Storage] Replit Object Storage disabled (Platform: ${process.platform}, OnReplit: ${onReplit})`);
      // No need to throw in constructor, but methods should behave accordingly
    } else {
      console.log(`[Storage] Replit Object Storage candidate detected (ProjectID: ${objectStorageClient.projectId}).`);
      if (!process.env.PUBLIC_OBJECT_SEARCH_PATHS || !process.env.PRIVATE_OBJECT_DIR) {
        console.warn(`[Storage] Replit environment detected but storage variables (PUBLIC_OBJECT_SEARCH_PATHS/PRIVATE_OBJECT_DIR) are missing.`);
      }

      // Verification check for the sidecar
      fetch(`${REPLIT_SIDECAR_ENDPOINT}/credential`)
        .then(res => {
          if (res.ok) console.log(`[Storage] ✅ Replit sidecar auth endpoint is reachable.`);
          else console.warn(`[Storage] ⚠️ Replit sidecar auth returned status ${res.status}`);
        })
        .catch(err => console.error(`[Storage] ❌ Replit sidecar unreachable: ${err.message}`));
    }
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
        "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
        "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object - adapted for Next.js Response
  // Note: This method is kept for backward compatibility but is not currently used.
  // The /objects route directly uses createReadStream instead.
  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      // Create read stream
      const stream = file.createReadStream();

      // Convert Node stream to Web stream
      const webStream = new ReadableStream({
        async start(controller) {
          stream.on('data', (chunk) => {
            controller.enqueue(chunk);
          });

          stream.on('end', () => {
            controller.close();
          });

          stream.on('error', (err) => {
            console.error('Stream error:', err);
            controller.error(err);
          });
        }
      });

      // Return Next.js Response with appropriate headers
      return new Response(webStream, {
        headers: {
          "Content-Type": metadata.contentType || "application/octet-stream",
          "Content-Length": metadata.size?.toString() || "0",
          "Cache-Control": `${isPublic ? "public" : "private"
            }, max-age=${cacheTtlSec}`,
        }
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      return new Response(
        JSON.stringify({ error: "Error downloading file" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
        "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  // Upload file directly (adapter for S3 compatibility)
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(body, {
      metadata: {
        contentType,
        cacheControl: 'max-age=31536000', // 1 year
      },
    });

    // Return the object path
    return `/objects/${key}`;
  }

  // Delete file (adapter for S3 compatibility)
  async deleteFile(key: string): Promise<void> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.delete();
  }

  // Check if file exists (adapter for S3 compatibility)
  async fileExists(key: string): Promise<boolean> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    return exists;
  }

  // Get presigned download URL (adapter for S3 compatibility)
  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: expiresIn,
    });
  }

  // Get presigned upload URL (adapter for S3 compatibility)
  async getPresignedUploadUrl(key: string, contentType: string, expiresIn: number = 300): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: expiresIn,
    });
  }

  // Get file stream (adapter for S3 compatibility)
  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${key}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    return file.createReadStream();
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1] || "";
  const objectName = pathParts.slice(2).join("/");

  if (!bucketName) {
    console.error(`[Storage Debug] Failed to parse bucket name from path: "${path}"`);
    throw new Error(`Invalid path: bucket name missing in "${path}"`);
  }

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  // CRITICAL FIX: Fail immediately if on Windows or invalid environment to trigger fallback
  if (process.platform === 'win32' || (!process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID)) {
    throw new Error("Cannot sign Replit Object URL on non-Replit environment (Windows/Local). Triggering fallback.");
  }

  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
      `make sure you're running on Replit`
    );
  }

  const responseData = await response.json();
  const signedURL = responseData.signed_url;

  if (!signedURL || typeof signedURL !== 'string') {
    throw new Error('Invalid response: missing or invalid signed_url');
  }

  return signedURL;
}
