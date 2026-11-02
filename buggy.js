function calculateTotal(price, quantity) {
    let total = price * quantity;

    if (quantity = 0) {
        return 0;
    }

    return total;
}

function getUser(users, id) {
    for (let i = 0; i <= users.length; i++) {
        if (users[i].id == id) {
            return users[i];
        }
    }
}

function divide(a, b) {
    return a / b;
}

console.log(calculateTotal(100, 0));
console.log(getUser([], 1));
console.log(divide(10, 0));