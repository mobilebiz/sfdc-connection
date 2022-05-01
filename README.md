# Twilio Flex Salesforce integration data connector

Twilio FlexのSalesforce integrationを使っている際に、Salesforce側のデータを検索するためのFunctionsです。  
認証には、Salesforceのサーバー間認証で推奨されているOAuth2.0 JWTベアラーフローを用います。OAuth2.0 JWTベアラーフローについて詳しく知りたい方は[こちらのドキュメント](https://help.salesforce.com/s/articleView?id=remoteaccess_oauth_jwt_flow.htm&type=5&language=ja)を参照してください。

## 準備

### プログラムのダウンロード

```sh
% git clone https://github.com/mobilebiz/sfdc-connection.git
% cd sfdc-connection
```

### 証明書の準備

証明書を作成します。

```sh
% cd cert
```

#### 秘密鍵の生成

```sh
% openssl genrsa -out sfdc.pem 2048
```

#### 証明書署名要求の作成

```sh
% openssl req -new -key sfdc.pem -out sfdc.csr
```

以下のような質問が表示されますが、`Country Name`と`Common Name`以外は指定しなくても大丈夫です。

```sh
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----

Country Name (2 letter code) [AU]:JP
State or Province Name (full name) [Some-State]:<Enter>
Locality Name (eg, city) []:<Enter>
Organization Name (eg, company) [Internet Widgits Pty Ltd]:<Enter>
Organizational Unit Name (eg, section) []:<Enter>
Common Name (e.g. server FQDN or YOUR name) []:localhost
Email Address []:<Enter>

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:<Enter>
An optional company name []:<Enter>
```

#### サーバー証明書の作成

今回は10年間（`-days 3650`）有効な証明書を作成します。証明書の有効期限は皆さんの判断で決定してください。

```sh
% openssl x509 -req -days 3650 -in sfdc.csr -signkey sfdc.pem -out sfdc.crt
```

#### 秘密鍵をAssetsにコピーする

外部からは読み取れないように、Assets内にプライベート属性で保存します。

```sh
% cp sfdc.pem ../assets/sfdc.private.pem
```

### Salesforceの準備

#### 接続アプリケーションの作成

APIでアクセスするために、接続アプリケーションを作成していきます。

- 設定から、アプリケーションマネージャーを開きます。
- 右上にある`新規接続アプリケーション`ボタンを押します。
- 以下の内容を設定していきます。

項目名|設定内容|補足
:--|:--|:--
接続アプリケーション名|FlexAPI|名前は何でもOKです
API参照名|FlexAPI|名前は何でもOKです
取引先責任者メール|管理者のメールドレス|エラーの通知などに利用されます
OAuth設定の有効化|チェック|
コールバックURL|http://localhost|ダミーURLでOKです
デジタル署名を使用|チェック|ファイルを選択ボタンが表示されるので、先ほど作成した`sfdc.crt`を指定します
|選択したOAuth範囲|以下の4つを選択|

|OAuth範囲で選択する項目|
|:--|
|APIを使用してユーザデータを管理(api)|
|ID URL サービスにアクセス(id, profile, email, address, phone)|
|Webブラウザを使用してユーザデータを管理(web)|
|いつでも要求を実行(refresh_token, offline_access)|

- `保存`ボタンを押して設定を保存します。設定変更に最大10分かかるというメッセージが表示されますが、そのまま`次へ`ボタンを押します。
- 続けて`Manage`ボタンを押します。
- さらに`ポリシーを編集`ボタンを押します。
- `許可されているユーザ`のプルダウンから「管理者が承認したユーザは事前承認済み」を選択します。
- `IP制限の緩和`のプルダウンから「IP制限の緩和」を選択します。
- `保存`ボタンを押してポリシーを更新します。
- ポリシーを保存すると、画面に`プロファイルを管理する`ボタンが出てくるので、それを押します。
- プロファイルのリストが表示されるので、今回は`システム管理者`にチェックを入れます。
- `保存`ボタンを押します。

APIで実行できる権限を細く設定したい場合は、独自のプロファイルを作成して適用するようにしてください。

#### コンシューマ鍵の保存

この後の作業で必要になりますので、以下の手順でコンシューマ鍵を表示し、どこかに保存しておいてください。

- 設定からアプリケーションマネージャを開きます。
- 今作成した`FlexAPI`の右側のプルダウンから`参照`を選択します。
- コンシューマ鍵が表示されるので、この値を保存しておきます。

### Twilioの準備

Twilio側については、Flexプロジェクトはもちろん、それ以外にTwilio CLIの設定とServerlessプラグインのインストールが必要です。  
[Twilio CLI（セットアップ編）](https://qiita.com/mobilebiz/items/456ce8b455f6aa84cc1e)
[Twilio CLI（サーバーレス開発編）](https://qiita.com/mobilebiz/items/fb4439bf162098e345ae)

## 環境変数の設定

```sh
% cp .env.sample .env
```

コピーした`.env`ファイルを開き、各パラメータを設定します。

パラメータ|設定値
:--|:--
ACCOUNT_SID|Twilio FlexプロジェクトのAccountSid（ACから始まる文字列）
AUTH_TOKEN|設定は不要です
SFDC_INSTANCE_URL|ご自分のSFDC環境を設定（https://xxxxxxxxxxxxxxxx.my.salesforce.com）
SFDC_LOGIN_URL|本番用は`https://login.salesforce.com`です
SFDC_USER_NAME|システム管理者のメールアドレスを指定します
SFDC_CONSUMER_KEY|先程保存しておいたコンシューマ鍵を指定します

## Functions

このプロジェクトには以下のFunctionsが用意されています。

### get-user-info

電話番号をキーに取引先責任者と取引先を検索し、該当する担当者がいた場合に会社名と名前を返します。  
該当担当者がいなかった場合は、`[新規]`を返します。

## Assets

このプロジェクトのAssetsフォルダには以下の2つのファイルができます。  
どちらのファイルも外部からはアクセスできないようにプライベート属性として管理しています。

### sfdc-token.private.js

SFDCに対してトークンを取得するためのクラスです。`get-user-info`内部で利用しています。

### sfdc.private.pem

先程、証明書を作成したときに生成した秘密鍵になります。

## ローカルテスト

```sh
% npm install
% npm run start
```

これでローカルの3000ポートで待ち受けが始まるので、ブラウザを開いて以下のURLでアクセスしてみます。  
`http://localhost:3000/get-user-info?phone=%208190XXXXXXXX`

※phoneパラメータには、検索したい電話番号をE.164形式（+81から始まる形式）で指定します。このとき、`+`は、`%20`と置き換えてください。  
存在しない電話番号のときは、`[新規]`と応答が返ります。salesforce上に取引先責任者が登録されていれば、会社名と名前が返ります。

## デプロイ

```sh
% npm run deploy
```

あとは、Twilio StudioなどからこのFunctionを呼び出せばOKです。
