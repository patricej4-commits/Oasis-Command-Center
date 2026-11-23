import { NextResponse } from 'next/server';

// The connector address must include the secret: /api/mcp/<AMY_CONNECTOR_SECRET>
const missing = () =>
  NextResponse.json(
    { error: 'Add your connector passphrase to the end of this address: /api/mcp/<passphrase>' },
    { status: 404 },
  );

export const GET = missing;
export const POST = missing;
