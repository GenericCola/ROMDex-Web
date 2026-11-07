import {test,expect} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";
import {routeYouTrack} from "./cookie-fixture";
import {setStatus,expectAssigned,statusButton} from "./task-status";
test.use({serviceWorkers:"block"});
// Delivery now locks only the syncing ticket (docs/TICKET-SCOPED-DELIVERY-2026-10-30.md); the auth gate also adds an outer .romdex-app.
test("web popup X remains usable during automatic delivery without unlocking task edits",async({page})=>{
 const app=page.locator(".romdex-app:not(.auth-connected)"),locked=statusButton(page,"Fixture Other");
 await page.clock.install();const s=await structuralFixture(page);await s.connect();await page.getByRole("switch",{name:"Auto-Sync Data",exact:true}).click();await page.getByRole("button",{name:"Fixture Other",exact:true}).last().click();
 // Auto-Sync now fires 750ms after the status popup closes; hold the clock so Filters opens first.
 await page.clock.pauseAt(new Date(Date.now()+1000));await setStatus(page,"Fixture Other","Standby");
 let started:()=>void=()=>{},release:()=>void=()=>{};const pending=new Promise<void>(resolve=>{started=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});await routeYouTrack(page,"https://thegobindsingh.youtrack.cloud/api/**",async route=>{if(route.request().method()==="POST"){started();await gate;}await route.fallback();});
 try{await page.getByRole("button",{name:"Filters",exact:true}).click();await page.clock.fastForward(11000);await pending;await expect(locked).toBeDisabled();await expect(app).not.toHaveAttribute("inert");const dialog=page.getByRole("dialog",{name:"Filters",exact:true});await dialog.getByRole("button",{name:"Close Filters",exact:true}).click();await expect(dialog).not.toBeVisible();await expect(locked).toBeDisabled();release();await expect(locked).toBeEnabled();await expect.poll(()=>s.tasks.get("PMON-900002")?.state).toBe("Standby");await s.confirmed();await expectAssigned(page,"Fixture Other","Standby");}finally{release();}
});
