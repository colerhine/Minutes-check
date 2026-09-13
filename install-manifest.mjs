const template="<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<OfficeApp xmlns=\"http://schemas.microsoft.com/office/appforoffice/1.1\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:type=\"TaskPaneApp\">\n  <Id>ce21f5e9-6774-46f0-8a11-df23d4b0b687</Id>\n  <Version>0.5.0.0</Version>\n  <ProviderName>Minutes Check</ProviderName>\n  <DefaultLocale>en-US</DefaultLocale>\n  <DisplayName DefaultValue=\"Minutes Check\"/>\n  <Description DefaultValue=\"Local chapter minutes review with slide comparison.\"/>\n  <Hosts><Host Name=\"Document\"/></Hosts>\n  <Requirements><Sets DefaultMinVersion=\"1.1\"><Set Name=\"WordApi\"/></Sets></Requirements>\n  <DefaultSettings><SourceLocation DefaultValue=\"https://localhost:3000/word.html\"/></DefaultSettings>\n  <Permissions>ReadWriteDocument</Permissions>\n</OfficeApp>\n";
export function manifestForSite(pageUrl){
  const page=new URL(pageUrl);
  if(page.protocol!=='https:'||page.username||page.password)throw Error('Open this page at your published HTTPS site before downloading.');
  page.search='';page.hash='';
  const url=new URL('word.html',page).href;
  const escaped=url.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return template.replace('https://localhost:3000/word.html',escaped);
}
