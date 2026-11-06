import {test,expect} from "@playwright/test";
import {installCookieFixture,openCookieFixture,routeYouTrack} from "./cookie-fixture";
test.use({serviceWorkers:"block"});
for(const uncertain of [false,true])test("manual save retains Auto-Sync off; uncertainty="+uncertain,async({page})=>{
  const raw={id:"2-test",idReadable:"PMON-900001",summary:"Synthetic cloud task",description:"Before",updated:1,project:{id:"0-1",shortName:"PMON"},parent:{issues:[]},customFields:["Type","State","Priority","Complexity"].map((name,i)=>({id:"92-"+i,name,$type:name==="State"?"StateIssueCustomField":"SingleEnumIssueCustomField",value:{name:{Type:"Task",State:"To do",Priority:"Normal",Complexity:"Low"}[name]}})),commentsCount:0,comments:[]};let posts=0;
  await installCookieFixture(page);
  await routeYouTrack(page,"https://thegobindsingh.youtrack.cloud/api/**",async route=>{
    const request=route.request(),url=new URL(request.url());const headers={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept,content-type","access-control-allow-methods":"GET, POST, OPTIONS"};
    if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers});return;}
    if(request.method()==="POST"){posts++;Object.assign(raw,JSON.parse(request.postData()??"{}"));if(uncertain){await route.abort();return;}await route.fulfill({headers,contentType:"application/json",body:"{}"});return;}
    const path=url.pathname,fields=["Type","State","Priority","Complexity"];const body=path==="/api/users/me"?{id:"fixture-owner"}:path==="/api/articles"?[]:path==="/api/admin/projects"?[{id:"0-1",shortName:"PMON"}]:path==="/api/admin/projects/0-1/customFields"?fields.map((name,i)=>({id:"92-"+i,field:{name,fieldType:{id:name==="State"?"state[1]":"enum[1]"}}})):path==="/api/issues"?[raw]:path==="/api/issues/PMON-900001"?raw:path.endsWith("/attachments")?[]:null;if(body===null)throw Error("Unexpected fixture request "+path);
    await route.fulfill({headers,contentType:"application/json",body:JSON.stringify(body)});
  });
  await openCookieFixture(page);
  await page.getByRole("button",{name:"Synthetic cloud task",exact:true}).last().click();await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("After");
  await page.getByRole("button",{name:/^Save Changes/}).click();
  if(uncertain){await expect(page.getByRole("button",{name:"Review saved changes",exact:true})).toBeVisible();await page.getByRole("button",{name:/^Save Changes/}).click();expect(posts).toBe(1);await page.getByRole("button",{name:/^Connection Details/}).click();await expect(page.locator(".delivery-review-card")).toBeVisible();await page.getByRole("button",{name:"Check whether this saved",exact:true}).click();await expect(page.locator(".delivery-review-card")).toHaveCount(0);await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();}
  else await expect(page.getByText("Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",{exact:true})).toBeVisible();
  expect(posts).toBe(1);await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toHaveAttribute("aria-checked","false");await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("After");await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toHaveAttribute("aria-checked","false");
});
