start transaction;

create table `rank`(
    `id` int not null,
    `name` varchar(255) not null,
    `description` longtext null,
    primary key (`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout`(
    `id` varchar(255) not null comment 'RFC 4122 UUID',
    `full_name` longtext null comment 'e.g. Samayamantri Venkata Rama Naga Butchi Anjaneya Satya Krishna Vijay',
    `short_name` longtext null comment 'e.g. Alice',
    `birthdate` date null,
    `join_time` timestamp(6) null,
    `country_code` longtext null comment 'ISO 3166-1 alpha-3 upper-case',
    `language_code` longtext null comment 'ISO 639-1 two-character lower-case',
    `pack_code` int unsigned null comment 'as administered by the Head Wolf',
    `rank` int null,
    `iana_country_code` longtext null comment 'playing with naming conventions',
    `what_about_this` bigint null,
    primary key (`id`),
    foreign key (`rank`) references `rank`(`id`))
engine = InnoDB
character set utf8mb4;

create table `badge`(
    `id` int not null,
    `name` varchar(255) not null,
    `description` longtext null,
    primary key (`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout_badges`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `value` int not null comment 'one of the badges in some .scouts.BoyScout',
    foreign key (`id`) references `boy_scout`(`id`),
    foreign key (`value`) references `badge`(`id`),
    index (`id`))
engine = InnoDB
character set utf8mb4;

create table `boy_scout_favorite_songs`(
    `id` varchar(255) not null comment 'id of the relevant .scouts.BoyScout',
    `value` longtext null comment 'one of the favorite_songs in some .scouts.BoyScout',
    foreign key (`id`) references `boy_scout`(`id`),
    index (`id`))
engine = InnoDB
character set utf8mb4
comment = 'formatted as  "Artist Name - Song Title"';

insert into `rank` (`id`, `name`, `description`) values
(0, 'RANK_UNKNOWN', null),
(1, 'RANK_WEBELOS', null),
(2, 'RANK_BOY_SCOUT', null),
(3, 'RANK_EAGLE_SCOUT', null),
(4, 'RANK_SPACE_CADET', null),
(5, 'RANK_SAMURAI', null);

insert into `badge` (`id`, `name`, `description`) values
(0, 'BADGE_UNKNOWN', null),
(1, 'BADGE_WOODWORKING', null),
(2, 'BADGE_FIRESTARTING', null),
(3, 'BADGE_RAINMAKING', null),
(4, 'BADGE_ASSKICKING', null),
(5, 'BADGE_HEADSCRATCHING', null),
(6, 'BADGE_BALLET', null),
(7, 'BADGE_FISHING', null);

commit;
