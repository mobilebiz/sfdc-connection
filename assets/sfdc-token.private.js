const fs = require('fs');
const request = require('request-promise');
module.exports = class SfdcToken {
  // コンストラクタ
  constructor(context) {
    this.context = context;
  }

  // トークン取得
  async getToken() {
    try {
      // 秘密鍵の読み込み
      const assets = Runtime.getAssets();
      const certPath = assets['/sfdc.pem'].path;
      const cert = fs.readFileSync(certPath);
      // JWTに記載されるメッセージの内容の定義
      let claim = {
        sub: this.context.SFDC_USER_NAME, // 接続するSalesforceのユーザアカウント名
        iss: this.context.SFDC_CONSUMER_KEY, // 接続アプリのコンシューマ鍵（client_id)
        aud: this.context.SFDC_LOGIN_URL, // 各ユーザのログインURL固定
        exp: Math.floor(Date.now() / 1000) + 3 * 60, // 現在時刻から3分間のみ、と有効期限を指定（指定は必須）
      };
      console.debug('===== claim =====');
      console.debug(JSON.stringify(claim, null, 4));

      // JWTの生成と、秘密鍵による署名
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(claim, cert, {
        algorithm: 'RS256',
        noTimestamp: true,
      });
      console.debug('===== JWT token =====');
      console.debug(token);

      // 接続先情報指定
      let options = {
        url: this.context.SFDC_LOGIN_URL + '/services/oauth2/token',
        method: 'POST',
        headers: {
          // form形式の指定が必要（ただし、'request'ライブラリ利用時は指定は無くてもPOSTでは自動付与される）
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', // JWTベアラートークンフローの指定。
          assertion: token, // 生成した暗号化済JWTトークン・署名を指定
        },
        json: true,
      };

      console.debug('===== request info =====');
      console.debug(JSON.stringify(options, null, 4));

      const result = await request(options);
      console.debug('===== result info =====');
      console.debug(JSON.stringify(result, null, 4));

      return {
        accessToken: result.access_token,
      };
    } catch (error) {
      console.error(error);
      return {
        error: error,
      };
    }
  }
};
