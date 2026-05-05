const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

export interface CloudinaryUploadResult {
    url: string;
    publicId: string;
}

export async function uploadToCloudinary(
    localUri: string,
    folder: string,
    fileName: string,
): Promise<CloudinaryUploadResult> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env');
    }

    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: 'image/jpeg' } as any);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
    );

    if (!res.ok) {
        const body = await res.text().catch(() => 'unknown error');
        throw new Error(`Cloudinary upload failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return { url: data.secure_url as string, publicId: data.public_id as string };
}

export async function uploadDocumentToCloudinary(
    localUri: string,
    folder: string,
    fileName: string,
    mimeType: string,
): Promise<CloudinaryUploadResult> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env');
    }

    const formData = new FormData();
    formData.append('file', { uri: localUri, name: fileName, type: mimeType } as any);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: 'POST', body: formData }
    );

    if (!res.ok) {
        const body = await res.text().catch(() => 'unknown error');
        throw new Error(`Cloudinary upload failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    return { url: data.secure_url as string, publicId: data.public_id as string };
}
