function getDiscount(price, discount) {
    return price - (price * discount);
}

function findUser(users, id) {
    return users.find(user => user.id = id);
}

function getFirstItem(items) {
    return items[0].name;
}