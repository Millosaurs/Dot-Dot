import axios from "axios";
import { headers } from "next/headers";
import {
  type SyncUpdatedResponse,
  type SyncResponse,
  type EmailMessage,
} from "./types";

export class Account {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async startSync() {
    const response = await axios.post<SyncResponse>(
      "https://api.aurinko.io/v1/email/sync",
      {},
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        params: {
          daysWithin: 2,
          bodyType: "html",
        },
      },
    );
    return response.data;
  }

  async getUpdatedEmails({
    deltaToken,
    pageToken,
  }: {
    deltaToken?: string;
    pageToken?: string;
  }) {
    let params: Record<string, string> = {};
    if (deltaToken) params.deltaToken = deltaToken;
    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get<SyncUpdatedResponse>(
      "https://api.aurinko.io/v1/email/sync/updated",
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        params,
      },
    );
    return response.data;
  }

  async performInitialSync() {
    try {
      let syncResponse = await this.startSync();
      while (!syncResponse.ready) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        syncResponse = await this.startSync();
      }

      // get the delta token
      let storedDeltaToken: string = syncResponse.syncUpdatedToken;

      let updatedResponce = await this.getUpdatedEmails({
        deltaToken: storedDeltaToken,
      });
      if (updatedResponce.nextDeltaToken) {
        // complted sync
        storedDeltaToken = updatedResponce.nextDeltaToken;
      }
      let allEmails: EmailMessage[] = updatedResponce.records;

      while (updatedResponce.nextDeltaToken) {
        updatedResponce = await this.getUpdatedEmails({
          pageToken: updatedResponce.nextPageToken,
        });
        allEmails = allEmails.concat(updatedResponce.records);
        if (updatedResponce.nextDeltaToken) {
          storedDeltaToken = updatedResponce.nextDeltaToken;
        }
      }

      console.log(
        "Initial sync completed, we habe synced",
        allEmails.length,
        "emails",
      );

      // store the latest delta token for future incremental syncs

      return {
        emails: allEmails,
        deltaToken: storedDeltaToken,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(
          "Error during sync:",
          JSON.stringify(error.response?.data, null, 2),
        );
      } else {
        console.log("Error during sync:", error);
      }
    }
  }
}
