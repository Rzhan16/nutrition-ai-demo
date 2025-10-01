import { NextRequest } from 'next/server'

/**
 * Simple test endpoint to verify Vercel deployment is working
 */

export async function GET() {
  return Response.json({
    success: true,
    message: 'Backend API is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      search: '/api/search-simple',
      analyze: '/api/analyze-simple',
      upload: '/api/upload'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return Response.json({
      success: true,
      message: 'POST request received',
      data: body,
      timestamp: new Date().toISOString()
    })
  } catch {
    return Response.json({
      success: false,
      error: 'Invalid JSON',
      message: 'Please send valid JSON data'
    }, { status: 400 })
  }
}
