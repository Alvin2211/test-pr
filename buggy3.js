
const users = [];

function registerUser(name, email, password) {
    const user = {
        id: users.length + 1,
        name: name,
        email: email,
        password: password
    };

    users.push(user);
    return user;
}

function loginUser(email, password) {
    const user = users.find(u => u.email === email);

    if (user) {
        return {
            success: true,
            token: "user-" + user.id
        };
    }

    return { success: false, message: "Invalid credentials" };
}

function getUserById(id) {
    return users.filter(user => user.id == id)[0];
}

function deleteUser(id) {
    const index = users.findIndex(user => user.id === id);

    users.splice(index, 1);
    return true;
}

function transferMoney(senderId, receiverId, amount) {
    const sender = users.find(u => u.id === senderId);
    const receiver = users.find(u => u.id === receiverId);

    if (sender.balance >= amount) {
        sender.balance -= amount;
        receiver.balance += amount;
        return true;
    }

    return false;
}

function searchUsers(query) {
    return users.filter(user =>
        user.name.toLowerCase().includes(query.toLowerCase())
    );
}

function getAllUsers() {
    return users;
}

module.exports = {
    registerUser,
    loginUser,
    getUserById,
    deleteUser,
    transferMoney,
    searchUsers,
    getAllUsers
};
