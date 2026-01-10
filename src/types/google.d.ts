/**
 * Type definitions for Google API libraries
 */

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(options?: { prompt?: string }): void;
      }

      interface TokenResponse {
        access_token: string;
        error?: string;
        expires_in: number;
        scope: string;
        token_type: string;
      }

      function initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }): TokenClient;

      function revoke(token: string, callback?: () => void): void;
    }
  }
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;

  namespace client {
    function init(config: { discoveryDocs: string[] }): Promise<void>;
    function getToken(): { access_token: string } | null;
    function setToken(token: null): void;

    namespace drive {
      namespace files {
        function list(params: {
          q?: string;
          fields?: string;
          spaces?: string;
          pageSize?: number;
          pageToken?: string;
          orderBy?: string;
        }): Promise<{
          result: {
            files?: Array<{
              id?: string;
              name?: string;
              mimeType?: string;
              modifiedTime?: string;
              size?: string;
              parents?: string[];
            }>;
            nextPageToken?: string;
          };
        }>;

        function get(
          params: { fileId: string; alt?: string },
          options?: { responseType?: string }
        ): Promise<{ body: string }>;
      }
    }
  }
}
