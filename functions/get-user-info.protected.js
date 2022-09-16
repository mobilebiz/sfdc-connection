require('dotenv').config();
const jsforce = require('jsforce');
exports.handler = async function (context, event, callback) {
  let accountName = '';
  let contactName = '';
  let address = '';
  try {
    // パラメータ取得
    const phone = event.phone;
    if (!phone) throw new Error('phone parameter not found.');

    // アクセストークンの取得
    const SfdcToken = require(Runtime.getAssets()['/sfdc-token.js'].path);
    const sfdcToken = new SfdcToken(context);
    const { accessToken } = await sfdcToken.getToken();
    console.debug(`accessToken: ${accessToken}`);

    // SFDCコネクション作成
    const conn = new jsforce.Connection({
      instanceUrl: process.env.SFDC_INSTANCE_URL,
      accessToken: accessToken,
    });

    // 取引先責任者の検索
    const contact = await conn
      .sobject('Contact')
      .find(
        {
          Phone: phone,
        },
        ['AccountId', 'Name', 'Phone', 'MailingAddress'],
      )
      .execute();
    console.info(`Contact: ${JSON.stringify(contact, null, '\t')}`);
    if (contact.length === 0) {
      accountName = '[新規]';
    } else {
      address = `${contact[0].MailingAddress.state}${contact[0].MailingAddress.city}${contact[0].MailingAddress.street}`;
      contactName = `${contact[0].Name} 様`;
      // 取引先の検索
      const account = await conn
        .sobject('Account')
        .find({ Id: contact[0].AccountId }, ['Id', 'Name'])
        .execute();
      console.info(`${JSON.stringify(account, null, '\t')}`);
      if (account.length > 0) {
        accountName = account[0].Name;
      }
    }
    const json = {
      name: `${accountName} ${contactName}`,
      address,
    };
    callback(null, json);
  } catch (error) {
    console.error(`👺 ERROR: ${error}`);
    callback(error);
  }
};
