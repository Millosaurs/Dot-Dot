import Account from "@/lib/account";
import { db } from "@/server/db";
import { NextResponse, NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const { accountId, userId } = await req.json();
  if (!accountId || !userId) {
    return NextResponse.json(
      { message: "Missing accountId or userId" },
      { status: 400 },
    );
  }
  const dbacc = await db.acc.findUnique({
    where: {
      id: accountId,
      userId,
    },
  });
  if (!dbacc) {
    return NextResponse.json(
      { message: "Account not found....." },
      { status: 400 },
    );
  }

  // perform initial sync

  const account = new Account(dbacc.accessToken);
  const responce = await account.performInitialSync();
  if (!responce) {
    return NextResponse.json(
      { message: "Failed to perform initial sync" },
      { status: 500 },
    );
  }
  await syncEmailsToDatabase(emails);
};
