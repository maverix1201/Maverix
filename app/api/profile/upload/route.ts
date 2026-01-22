import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type - accept images, PDFs, and documents
    const allowedTypes = [
      'image/', // All image types
      'application/pdf', // PDF files
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];
    
    const isValidType = allowedTypes.some(type => file.type.startsWith(type) || file.type === type);
    if (!isValidType) {
      return NextResponse.json({ 
        error: 'File must be an image, PDF, or document (DOC/DOCX)' 
      }, { status: 400 });
    }

    // Validate file size
    // Images: max 5MB (will be compressed client-side to ~100KB)
    // PDFs/Documents: max 5MB
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ 
        error: `File size must be less than ${Math.round(maxSizeBytes / 1024 / 1024)}MB. Current size: ${Math.round(file.size / 1024 / 1024)}MB` 
      }, { status: 400 });
    }

    // Convert file to base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64String = buffer.toString('base64');
    
    // Create data URL (works in serverless environments)
    const dataUrl = `data:${file.type};base64,${base64String}`;

    return NextResponse.json({
      message: 'File uploaded successfully',
      url: dataUrl,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

