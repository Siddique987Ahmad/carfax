// Once per test run: make sure the app's database user can log in (same as the db package's tests).
export { provisionAppUserForTests as default } from '@carfax/db/testing';
