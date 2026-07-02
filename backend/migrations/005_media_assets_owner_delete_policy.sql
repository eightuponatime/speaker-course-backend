alter table media_assets
    drop constraint if exists media_assets_owner_id_fkey;

alter table media_assets
    alter column owner_id drop not null;

alter table media_assets
    add constraint media_assets_owner_id_fkey
    foreign key (owner_id)
    references users(id)
    on delete set null;
